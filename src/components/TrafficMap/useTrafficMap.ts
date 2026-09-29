"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  createNaverMap,
  loadNaverMapsSdk,
  type NaverMapController,
} from "@/adapters/map/naverMap.adapter";
import {
  INTERSECTION_QUERY_MIN_ZOOM,
  MAP_IDLE_DEBOUNCE_MS,
  RESTROOM_QUERY_MIN_ZOOM,
  SEOUL_CITY_HALL_COORDINATE,
  SEOUL_LEGAL_CODE_PREFIX,
  TRASH_BIN_QUERY_MIN_ZOOM,
} from "@/constants/map";
import { SIGNAL_STALE_AFTER_MS } from "@/constants/signal";
import {
  fetchIntersections,
  fetchPedestrianSignal,
  fetchRestrooms,
  fetchTrashBins,
} from "@/services/greenGreenApi";
import type { Intersection } from "@/types/intersection";
import type {
  MapBounds,
  MapCoordinate,
  MapLayer,
  MapRegion,
  MapViewport,
} from "@/types/map";
import type { Restroom } from "@/types/restroom";

type MapStatus = "loading" | "ready" | "error";
type LocationStatus = "idle" | "locating" | "error";
type LocationMode = "inactive" | "current" | "tracking";
type CompassOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};
type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<"granted" | "denied">;
};
type ServiceAreaStatus =
  | "checking"
  | "supported"
  | "unsupported"
  | "unknown";

const NAVER_MAP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const TRASH_BIN_DATA_VERSION = "v1" as const;
const MISSING_CLIENT_ID_MESSAGE =
  "NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 환경변수를 설정해 주세요.";

const LOCATION_ERROR_MESSAGES: Record<number, string> = {
  1: "위치 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해 주세요.",
  2: "현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  3: "위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.",
};

function normalizeHeading(heading: number): number {
  return ((heading % 360) + 360) % 360;
}

function getDeviceHeading(event: CompassOrientationEvent): number | null {
  // 1. iOS Safari가 제공하는 실제 나침반 방향을 우선 사용한다.
  // webkitCompassHeading은 북쪽 0도에서 시계 방향으로 증가해 마커 회전에 바로 사용할 수 있다.
  if (
    typeof event.webkitCompassHeading === "number" &&
    Number.isFinite(event.webkitCompassHeading) &&
    (event.webkitCompassAccuracy === undefined ||
      event.webkitCompassAccuracy >= 0)
  ) {
    return normalizeHeading(event.webkitCompassHeading);
  }

  // 2. 표준 절대 방향 이벤트가 아니거나 alpha가 없으면 방향을 추측하지 않는다.
  // 상대 방향의 alpha는 페이지가 열린 자세를 기준으로 하므로 실제 북쪽과 맞지 않는다.
  if (
    event.alpha === null ||
    (!event.absolute && event.type !== "deviceorientationabsolute")
  ) {
    return null;
  }

  // 3. 기울기 정보가 없거나 기기를 평평하게 둔 경우 alpha만 나침반 방향으로 변환한다.
  // 이 경우 표준 좌표계에서 실제 방위각은 360도에서 alpha를 뺀 값이다.
  if (
    event.beta === null ||
    event.gamma === null ||
    (Math.abs(event.beta) < 1 && Math.abs(event.gamma) < 1)
  ) {
    return normalizeHeading(360 - event.alpha);
  }

  // 4. 기울여 든 기기는 W3C 예제의 회전 행렬로 화면 정면의 수평 방위를 계산한다.
  // alpha만 사용할 때 발생하는 세로로 든 휴대폰의 방향 오차를 줄이기 위한 처리다.
  const degreesToRadians = Math.PI / 180;
  const alpha = event.alpha * degreesToRadians;
  const beta = event.beta * degreesToRadians;
  const gamma = event.gamma * degreesToRadians;
  const vectorX =
    -Math.cos(alpha) * Math.sin(gamma) -
    Math.sin(alpha) * Math.sin(beta) * Math.cos(gamma);
  const vectorY =
    -Math.sin(alpha) * Math.sin(gamma) +
    Math.cos(alpha) * Math.sin(beta) * Math.cos(gamma);

  return normalizeHeading(
    Math.atan2(vectorX, vectorY) / degreesToRadians,
  );
}

function getHeadingDifference(previous: number, next: number): number {
  const difference = Math.abs(previous - next);
  return Math.min(difference, 360 - difference);
}

function normalizeCoordinate(value: number): number {
  // 좌표의 미세한 변화마다 새 Query Key가 생기지 않도록 약 10m 단위로 맞춘다.
  return Math.round(value * 10_000) / 10_000;
}

function normalizeBounds(bounds: MapBounds): MapBounds {
  return {
    north: normalizeCoordinate(bounds.north),
    east: normalizeCoordinate(bounds.east),
    south: normalizeCoordinate(bounds.south),
    west: normalizeCoordinate(bounds.west),
  };
}

function getBoundsCenter(bounds: MapBounds): MapCoordinate {
  return {
    latitude: (bounds.north + bounds.south) / 2,
    longitude: (bounds.east + bounds.west) / 2,
  };
}

function getRegionCacheKey(coordinate: MapCoordinate): string {
  // 약 100m 단위의 중심 좌표는 같은 지역 판별 결과를 재사용한다.
  // 작은 지도 이동마다 Reverse Geocoding 사용량이 늘어나는 것을 막기 위한 정규화다.
  return `${coordinate.latitude.toFixed(3)},${coordinate.longitude.toFixed(3)}`;
}

export function useTrafficMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapControllerRef = useRef<NaverMapController | null>(null);
  const locationModeRef = useRef<LocationMode>("inactive");
  const geolocationWatchIdRef = useRef<number | null>(null);
  const deviceOrientationCleanupRef = useRef<(() => void) | null>(null);
  const orientationFrameRef = useRef<number | null>(null);
  const pendingDeviceHeadingRef = useRef<number | null>(null);
  const deviceHeadingRef = useRef<number | null>(null);
  const renderedDeviceHeadingRef = useRef<number | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>(
    NAVER_MAP_CLIENT_ID ? "loading" : "error",
  );
  const [mapErrorMessage, setMapErrorMessage] = useState(
    NAVER_MAP_CLIENT_ID ? "" : MISSING_CLIENT_ID_MESSAGE,
  );
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>("signals");
  const [selectedIntersection, setSelectedIntersection] =
    useState<Intersection | null>(null);
  const [selectedRestroom, setSelectedRestroom] =
    useState<Restroom | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [locationMode, setLocationMode] =
    useState<LocationMode>("inactive");
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaStatus>("checking");
  const [unsupportedRegionName, setUnsupportedRegionName] = useState("");

  const updateLocationMode = useCallback((mode: LocationMode) => {
    // 상태와 ref를 같은 시점에 갱신해 비동기 위치 콜백도 최신 모드를 확인하게 한다.
    locationModeRef.current = mode;
    setLocationMode(mode);
  }, []);

  const stopDeviceOrientationTracking = useCallback(() => {
    // 1. 등록한 방향 이벤트를 해제해 고정 모드 밖에서 센서를 계속 사용하지 않게 한다.
    deviceOrientationCleanupRef.current?.();
    deviceOrientationCleanupRef.current = null;

    // 2. 예약된 화면 갱신을 취소하고 센서 방향 캐시를 초기화한다.
    // 다음 고정 시작 때 이전 기기 방향이 GPS 이동 방향보다 먼저 표시되지 않게 한다.
    if (orientationFrameRef.current !== null) {
      window.cancelAnimationFrame(orientationFrameRef.current);
      orientationFrameRef.current = null;
    }
    pendingDeviceHeadingRef.current = null;
    deviceHeadingRef.current = null;
    renderedDeviceHeadingRef.current = null;
  }, []);

  const startDeviceOrientationTracking = useCallback(async () => {
    if (!("DeviceOrientationEvent" in window)) {
      return;
    }

    const orientationEventConstructor = window.DeviceOrientationEvent as
      DeviceOrientationEventWithPermission;

    // 1. iOS처럼 명시적 권한이 필요한 브라우저는 버튼 클릭 흐름 안에서 요청한다.
    // 거부되거나 요청에 실패해도 GPS 이동 방향 추적은 계속 사용할 수 있게 조용히 대체한다.
    if (orientationEventConstructor.requestPermission) {
      try {
        const permission =
          await orientationEventConstructor.requestPermission(true);

        if (permission !== "granted") {
          return;
        }
      } catch {
        return;
      }
    }

    if (locationModeRef.current !== "tracking") {
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const heading = getDeviceHeading(event as CompassOrientationEvent);

      if (heading === null || locationModeRef.current !== "tracking") {
        return;
      }

      pendingDeviceHeadingRef.current = heading;

      if (orientationFrameRef.current !== null) {
        return;
      }

      // 2. 센서 이벤트를 애니메이션 프레임당 한 번으로 제한한다.
      // 고주파 센서 이벤트마다 NAVER 마커 DOM을 교체해 렌더링이 과도해지는 것을 막는다.
      orientationFrameRef.current = window.requestAnimationFrame(() => {
        orientationFrameRef.current = null;
        const nextHeading = pendingDeviceHeadingRef.current;

        if (nextHeading === null || locationModeRef.current !== "tracking") {
          return;
        }

        const previousHeading = renderedDeviceHeadingRef.current;

        // 3. 3도 미만의 작은 흔들림은 무시해 마커가 제자리에서 떨리는 현상을 줄인다.
        // 0도와 360도 경계를 지날 때도 가장 짧은 각도 차이를 기준으로 비교한다.
        if (
          previousHeading !== null &&
          getHeadingDifference(previousHeading, nextHeading) < 3
        ) {
          return;
        }

        deviceHeadingRef.current = nextHeading;
        renderedDeviceHeadingRef.current = nextHeading;
        mapControllerRef.current?.setCurrentLocationHeading(nextHeading);
      });
    };

    // 4. 표준 절대 방향 이벤트와 iOS 호환 이벤트를 함께 구독한다.
    // 실제 북쪽 기준 값만 getDeviceHeading에서 선별하므로 상대 방향은 표시하지 않는다.
    window.addEventListener("deviceorientationabsolute", handleOrientation);
    window.addEventListener("deviceorientation", handleOrientation);
    deviceOrientationCleanupRef.current = () => {
      window.removeEventListener("deviceorientationabsolute", handleOrientation);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  const stopLocationTracking = useCallback(() => {
    // 1. 활성 watch만 해제해 중복 구독과 해제 이후의 위치 콜백을 방지한다.
    if (geolocationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      geolocationWatchIdRef.current = null;
    }

    // 2. 위치 고정과 함께 시작한 방향 센서 구독도 같은 생명주기로 정리한다.
    stopDeviceOrientationTracking();
  }, [stopDeviceOrientationTracking]);

  useEffect(() => {
    let cancelled = false;
    let removeIdleListener: (() => void) | undefined;
    let removeUserMoveListener: (() => void) | undefined;
    let debounceTimer: number | undefined;
    let regionLookupSequence = 0;
    let hasResolvedRegion = false;
    const regionCache = new Map<string, MapRegion | null>();

    if (!NAVER_MAP_CLIENT_ID) {
      return;
    }

    const initializeMap = async () => {
      try {
        // 1. SDK를 먼저 준비한다.
        // 지도 인스턴스는 NAVER 전역 객체가 생성된 뒤에만 안전하게 만들 수 있다.
        const sdk = await loadNaverMapsSdk(NAVER_MAP_CLIENT_ID);

        // 2. 비동기 로딩 중 컴포넌트가 해제되었는지 확인한다.
        // 해제된 DOM에 지도를 붙이거나 상태를 갱신하는 일을 막기 위한 순서다.
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        // 3. 어댑터를 통해 지도를 만들고 idle 이벤트만 구독한다.
        // 이동 중 요청을 반복하지 않고, 이동이 끝난 뒤 최종 범위만 조회한다.
        const controller = createNaverMap(
          mapContainerRef.current,
          SEOUL_CITY_HALL_COORDINATE,
          sdk,
        );
        mapControllerRef.current = controller;

        const updateViewportAndRegion = async () => {
          // 1. 지도 범위를 먼저 반영하고 중심 좌표를 지역 판별 기준으로 사용한다.
          // 사용자가 GPS와 무관하게 지도를 직접 이동한 경우에도 같은 기준으로 처리하기 위함이다.
          const nextViewport = controller.getViewport();
          const centerCoordinate = getBoundsCenter(nextViewport.bounds);
          const cacheKey = getRegionCacheKey(centerCoordinate);
          const lookupSequence = ++regionLookupSequence;

          setViewport(nextViewport);

          if (!hasResolvedRegion) {
            setServiceAreaStatus("checking");
          }

          try {
            // 2. 가까운 중심 좌표의 결과는 캐시하고, 새 위치만 Reverse Geocoding으로 확인한다.
            // 지도 idle마다 동일한 지역 API가 반복 호출되는 것을 줄이기 위한 처리다.
            let region = regionCache.get(cacheKey);

            if (!regionCache.has(cacheKey)) {
              region = await controller.resolveRegion(centerCoordinate);
              regionCache.set(cacheKey, region);
            }

            // 3. 더 최근 지도 이동이 시작됐다면 이전 위치의 늦은 응답을 무시한다.
            // 비동기 응답 순서가 뒤바뀌어 서울 밖 안내가 잘못 표시되는 경쟁 상태를 막는다.
            if (cancelled || lookupSequence !== regionLookupSequence) {
              return;
            }

            hasResolvedRegion = true;

            if (!region) {
              setServiceAreaStatus("unknown");
              setUnsupportedRegionName("");
              return;
            }

            const isSeoul = region.legalCode.startsWith(
              SEOUL_LEGAL_CODE_PREFIX,
            );

            setServiceAreaStatus(isSeoul ? "supported" : "unsupported");
            setUnsupportedRegionName(isSeoul ? "" : region.area1Name);

            if (!isSeoul) {
              // 서울에서 선택한 교차로가 다른 지역에서도 계속 polling되지 않도록 즉시 해제한다.
              setSelectedIntersection(null);
            }
          } catch {
            if (cancelled || lookupSequence !== regionLookupSequence) {
              return;
            }

            // Reverse Geocoding 설정이나 네트워크에 문제가 있어도 기존 서울 지도는 계속 사용한다.
            hasResolvedRegion = true;
            setServiceAreaStatus("unknown");
            setUnsupportedRegionName("");
          }
        };

        const updateViewport = () => {
          window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => {
            if (!cancelled) {
              void updateViewportAndRegion();
            }
          }, MAP_IDLE_DEBOUNCE_MS);
        };

        // 4. 초기 범위를 즉시 저장한 뒤 준비 상태로 전환한다.
        // 첫 idle 이벤트를 기다리지 않아도 현재 줌에 맞는 안내와 조회가 시작된다.
        removeIdleListener = controller.onIdle(updateViewport);
        removeUserMoveListener = controller.onUserMove(() => {
          // 사용자가 지도를 직접 조작하면 1회 위치와 고정 추적을 모두 해제한다.
          // 지도 중심이 GPS와 다르게 이동한 상태를 활성 위치 모드로 표시하지 않기 위함이다.
          stopLocationTracking();
          updateLocationMode("inactive");
          setLocationStatus("idle");
          setLocationMessage("");
        });
        void updateViewportAndRegion();
        setMapStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMapStatus("error");
        setMapErrorMessage(
          error instanceof Error
            ? error.message
            : "지도를 불러오는 중 문제가 발생했습니다.",
        );
      }
    };

    void initializeMap();

    return () => {
      // 지도 이벤트와 마커가 다음 마운트에 남지 않도록 역순으로 정리한다.
      cancelled = true;
      window.clearTimeout(debounceTimer);
      removeIdleListener?.();
      removeUserMoveListener?.();
      stopLocationTracking();
      mapControllerRef.current?.destroy();
      mapControllerRef.current = null;
    };
  }, [stopLocationTracking, updateLocationMode]);

  const normalizedBounds = useMemo(
    () => (viewport ? normalizeBounds(viewport.bounds) : null),
    [viewport],
  );
  // 1. 지도 준비 여부와 줌 임계값을 먼저 확인한다.
  // 범위 쿼리를 비활성화해 멀리서 불필요한 교차로 데이터를 가져오지 않는다.
  const isIntersectionQueryEnabled =
    activeLayer === "signals" &&
    mapStatus === "ready" &&
    (serviceAreaStatus === "supported" || serviceAreaStatus === "unknown") &&
    viewport !== null &&
    viewport.zoom >= INTERSECTION_QUERY_MIN_ZOOM &&
    normalizedBounds !== null;

  const intersectionsQuery = useQuery({
    // 2. 정규화된 범위를 Query Key로 사용한다.
    // 같은 화면으로 간주할 수 있는 작은 좌표 변화는 캐시를 공유한다.
    queryKey: ["intersections", normalizedBounds],
    queryFn: () =>
      normalizedBounds ? fetchIntersections(normalizedBounds) : Promise.resolve([]),
    enabled: isIntersectionQueryEnabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const isTrashBinQueryEnabled =
    activeLayer === "trashBins" &&
    mapStatus === "ready" &&
    viewport !== null &&
    viewport.zoom >= TRASH_BIN_QUERY_MIN_ZOOM &&
    normalizedBounds !== null;

  const trashBinsQuery = useQuery({
    // 3. 휴지통 탭과 줌 조건을 만족할 때만 현재 범위의 정적 위치를 조회한다.
    // 비활성 레이어의 API 호출과 보이지 않는 마커 생성을 함께 막는다.
    queryKey: ["trashBins", TRASH_BIN_DATA_VERSION, normalizedBounds],
    queryFn: () =>
      normalizedBounds
        ? fetchTrashBins(normalizedBounds, TRASH_BIN_DATA_VERSION)
        : Promise.resolve([]),
    enabled: isTrashBinQueryEnabled,
    staleTime: 30 * 60_000,
    placeholderData: (previousData, previousQuery) => {
      // 4. 같은 데이터 버전에서 지도 범위만 바뀌면 이전 결과를 응답 전까지 유지한다.
      // v1과 v2를 전환할 때는 서로 다른 출처의 마커가 잠시 섞이지 않도록 유지하지 않는다.
      return previousQuery?.queryKey[1] === TRASH_BIN_DATA_VERSION
        ? previousData
        : undefined;
    },
  });

  const isRestroomQueryEnabled =
    activeLayer === "restrooms" &&
    mapStatus === "ready" &&
    viewport !== null &&
    viewport.zoom >= RESTROOM_QUERY_MIN_ZOOM &&
    normalizedBounds !== null;

  const restroomsQuery = useQuery({
    // 5. 화장실 레이어와 줌 조건을 모두 만족할 때만 현재 범위를 조회한다.
    // 다른 레이어를 보는 동안 불필요한 API 호출과 마커 생성을 하지 않는다.
    queryKey: ["restrooms", normalizedBounds],
    queryFn: () =>
      normalizedBounds
        ? fetchRestrooms(normalizedBounds)
        : Promise.resolve([]),
    enabled: isRestroomQueryEnabled,
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });

  const handleSelectIntersection = useCallback(
    (intersection: Intersection) => setSelectedIntersection(intersection),
    [],
  );
  const handleSelectRestroom = useCallback(
    (restroom: Restroom) => setSelectedRestroom(restroom),
    [],
  );
  const activeSelectedRestroom = isRestroomQueryEnabled
    ? selectedRestroom
    : null;
  const activeSelectedIntersection = isIntersectionQueryEnabled
    ? selectedIntersection
    : null;

  const signalQuery = useQuery({
    // 3. 사용자가 선택한 교차로만 실시간 신호를 조회한다.
    // 정기 폴링 없이 잔여시간 종료 또는 stale 임박 시에만 재조회해 API 호출량을 제한한다.
    queryKey: ["signal", activeSelectedIntersection?.intersectionId],
    queryFn: () =>
      activeSelectedIntersection
        ? fetchPedestrianSignal(activeSelectedIntersection.intersectionId)
        : Promise.reject(new Error("교차로가 선택되지 않았습니다.")),
    enabled: activeSelectedIntersection !== null,
    staleTime: 3_000,
  });
  const refetchSignal = signalQuery.refetch;
  const handleRefreshSignal = useCallback(() => {
    // 자동 동기화가 겹치면 진행 중인 요청을 취소하지 않고 기존 요청을 공유한다.
    void refetchSignal({ cancelRefetch: false });
  }, [refetchSignal]);

  useEffect(() => {
    const controller = mapControllerRef.current;

    if (!controller) {
      return;
    }

    const visibleIntersections = isIntersectionQueryEnabled
      ? (intersectionsQuery.data ?? [])
      : [];
    const selectedIntersectionId =
      activeSelectedIntersection?.intersectionId ?? null;
    const signal =
      signalQuery.data?.intersectionId === selectedIntersectionId
        ? signalQuery.data
        : null;
    const receivedTime = signal
      ? new Date(signal.receivedAt).getTime()
      : Number.NaN;
    const isSignalFresh =
      signal !== null &&
      !signal.isStale &&
      Number.isFinite(receivedTime) &&
      Date.now() - receivedTime <= SIGNAL_STALE_AFTER_MS;
    const visibleSignal = isSignalFresh ? signal : null;

    const visibleTrashBins = isTrashBinQueryEnabled
      ? (trashBinsQuery.data ?? [])
      : [];
    const visibleRestrooms = isRestroomQueryEnabled
      ? (restroomsQuery.data ?? [])
      : [];

    // 4. 활성 탭에 해당하는 마커만 전달하고 다른 레이어는 빈 배열로 즉시 비운다.
    // 탭 전환 뒤 두 종류의 마커가 겹치거나 비활성 데이터가 남는 것을 방지한다.
    // 줌이 임계값 아래이거나 신호가 오래되면 방향 강조를 즉시 제거한다.
    controller.setIntersections(
      visibleIntersections,
      selectedIntersectionId,
      visibleSignal,
      handleSelectIntersection,
    );
    controller.setTrashBins(visibleTrashBins);
    controller.setRestrooms(
      visibleRestrooms,
      activeSelectedRestroom?.restroomId ?? null,
      handleSelectRestroom,
    );

    if (!visibleSignal) {
      return;
    }

    // 5. 다음 동기화가 실패해도 수신 시각이 stale 기준을 넘으면 방향 색상을 제거한다.
    // 오래된 보행 가능 화살표가 지도에 계속 남는 안전 문제를 방지한다.
    const staleTimer = window.setTimeout(() => {
      controller.setIntersections(
        visibleIntersections,
        selectedIntersectionId,
        null,
        handleSelectIntersection,
      );
    }, Math.max(0, receivedTime + SIGNAL_STALE_AFTER_MS - Date.now()));

    return () => window.clearTimeout(staleTimer);
  }, [
    activeSelectedIntersection?.intersectionId,
    activeSelectedRestroom?.restroomId,
    handleSelectIntersection,
    handleSelectRestroom,
    intersectionsQuery.data,
    isIntersectionQueryEnabled,
    isRestroomQueryEnabled,
    isTrashBinQueryEnabled,
    restroomsQuery.data,
    signalQuery.data,
    trashBinsQuery.data,
  ]);

  const handleCurrentLocation = useCallback(() => {
    // 1. 브라우저와 지도 준비 상태를 확인한다.
    // 위치 권한을 요청한 뒤 지도가 없어 결과를 쓰지 못하는 상황을 피한다.
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("이 브라우저는 현재 위치 기능을 지원하지 않습니다.");
      return;
    }

    const controller = mapControllerRef.current;

    if (!controller) {
      return;
    }

    // 2. 위치 고정 상태에서 누르면 추적과 마커를 모두 해제한다.
    // 세 번째 클릭으로 명시적으로 비활성 상태로 돌아가는 순환을 만든다.
    if (locationModeRef.current === "tracking") {
      stopLocationTracking();
      controller.clearCurrentLocation();
      updateLocationMode("inactive");
      setLocationStatus("idle");
      setLocationMessage("");
      return;
    }

    const handlePositionError = ({ code }: GeolocationPositionError) => {
      stopLocationTracking();
      controller.clearCurrentLocation();
      updateLocationMode("inactive");
      setLocationStatus("error");
      setLocationMessage(
        LOCATION_ERROR_MESSAGES[code] ??
          "현재 위치를 확인하는 중 문제가 발생했습니다.",
      );
    };

    // 3. 현재 위치 상태에서 한 번 더 누르면 실시간 위치 고정을 시작한다.
    // watchPosition의 새 좌표마다 줌은 유지하고 중심과 위치 마커만 갱신한다.
    if (locationModeRef.current === "current") {
      setLocationStatus("idle");
      setLocationMessage("");
      updateLocationMode("tracking");
      void startDeviceOrientationTracking();

      geolocationWatchIdRef.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          if (locationModeRef.current !== "tracking") {
            return;
          }

          controller.moveTo(
            {
              latitude: coords.latitude,
              longitude: coords.longitude,
            },
            false,
            deviceHeadingRef.current ?? coords.heading,
          );
        },
        handlePositionError,
        {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 5_000,
        },
      );
      return;
    }

    // 4. 비활성 상태의 첫 클릭은 현재 위치를 한 번만 조회해 지도를 이동한다.
    // 성공 후에는 추적하지 않는 현재 위치 상태로 전환해 두 번째 클릭을 기다린다.
    setLocationStatus("locating");
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinate: MapCoordinate = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        controller.moveTo(coordinate, true, coords.heading);
        updateLocationMode("current");
        setLocationStatus("idle");
        setLocationMessage("");
      },
      handlePositionError,
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      },
    );
  }, [
    startDeviceOrientationTracking,
    stopLocationTracking,
    updateLocationMode,
  ]);

  const intersections = intersectionsQuery.data ?? [];
  const trashBins = trashBinsQuery.data ?? [];
  const restrooms = restroomsQuery.data ?? [];
  const intersectionErrorMessage =
    intersectionsQuery.error instanceof Error
      ? intersectionsQuery.error.message
      : "";
  const signalErrorMessage =
    signalQuery.error instanceof Error ? signalQuery.error.message : "";
  const trashBinErrorMessage =
    trashBinsQuery.error instanceof Error ? trashBinsQuery.error.message : "";
  const restroomErrorMessage =
    restroomsQuery.error instanceof Error ? restroomsQuery.error.message : "";

  let guide = {
    eyebrow: `ZOOM! ZOOM!`,
    title: "지도를 조금 더 확대해 주세요",
    description:
      "신호 제공 교차로를 정확하게 표시하기 위해 가까운 지도에서만 정보를 불러옵니다.",
  };

  // 활성 레이어의 조회 가능 여부를 먼저 본 뒤 로딩, 오류, 빈 결과, 성공 순으로 안내한다.
  // 동시에 여러 상태가 참이어도 사용자에게 가장 우선적인 상태 하나만 보여준다.
  if (activeLayer === "restrooms" && isRestroomQueryEnabled && restroomsQuery.isLoading) {
    guide = {
      eyebrow: "화장실 확인 중",
      title: "주변 화장실을 찾고 있어요",
      description: "현재 지도 범위에 등록된 공중화장실 위치를 확인하고 있습니다.",
    };
  } else if (activeLayer === "restrooms" && isRestroomQueryEnabled && restroomErrorMessage) {
    guide = {
      eyebrow: "조회 지연",
      title: "화장실 정보를 가져오지 못했어요",
      description: restroomErrorMessage,
    };
  } else if (activeLayer === "restrooms" && isRestroomQueryEnabled && restrooms.length === 0) {
    guide = {
      eyebrow: "등록 정보 없음",
      title: "이 범위에는 등록된 화장실이 없어요",
      description: "지도를 이동해 다른 지역의 공중화장실을 확인해 보세요.",
    };
  } else if (activeLayer === "restrooms" && isRestroomQueryEnabled) {
    guide = {
      eyebrow: `${restrooms.length}개 화장실`,
      title: "화장실 마커를 선택해 주세요",
      description: "파란색 화장실 마커를 누르면 운영 시간과 시설 정보를 확인할 수 있습니다.",
    };
  } else if (activeLayer === "restrooms") {
    guide = {
      eyebrow: "ZOOM! ZOOM!",
      title: "지도를 조금 더 확대해 주세요",
      description: `화장실 위치는 지도 확대 단계 ${RESTROOM_QUERY_MIN_ZOOM}부터 표시합니다.`,
    };
  } else if (activeLayer === "trashBins" && isTrashBinQueryEnabled && trashBinsQuery.isLoading) {
    guide = {
      eyebrow: "휴지통 확인 중",
      title: "주변 휴지통을 찾고 있어요",
      description: "현재 지도 범위에 등록된 공공 휴지통 위치를 확인하고 있습니다.",
    };
  } else if (activeLayer === "trashBins" && isTrashBinQueryEnabled && trashBinErrorMessage) {
    guide = {
      eyebrow: "조회 지연",
      title: "휴지통 정보를 가져오지 못했어요",
      description: trashBinErrorMessage,
    };
  } else if (activeLayer === "trashBins" && isTrashBinQueryEnabled && trashBins.length === 0) {
    guide = {
      eyebrow: "등록 정보 없음",
      title: "이 범위에는 등록된 휴지통이 없어요",
      description: "지도를 이동해 다른 지역의 공공 휴지통을 확인해 보세요.",
    };
  } else if (activeLayer === "trashBins" && isTrashBinQueryEnabled) {
    guide = {
      eyebrow: `${trashBins.length}개 휴지통`,
      title: "주변 휴지통 위치를 확인해 보세요",
      description: "회색 휴지통 마커는 공공데이터에 등록된 설치 위치입니다.",
    };
  } else if (activeLayer === "trashBins") {
    guide = {
      eyebrow: "ZOOM! ZOOM!",
      title: "지도를 조금 더 확대해 주세요",
      description: `휴지통 위치는 지도 확대 단계 ${TRASH_BIN_QUERY_MIN_ZOOM}부터 표시됩니다.`,
    };
  } else if (serviceAreaStatus === "checking") {
    guide = {
      eyebrow: "서비스 지역 확인 중",
      title: "현재 지도 지역을 확인하고 있어요",
      description: "서울 지역의 보행신호 제공 여부를 확인하고 있습니다.",
    };
  } else if (serviceAreaStatus === "unsupported") {
    guide = {
      eyebrow: "서비스 준비 중",
      title: `${unsupportedRegionName || "서울 외 지역"}은 아직 준비 중이에요`,
      description:
        "현재 GreenGreen은 서울 지역의 보행신호를 제공하고 있습니다.",
    };
  } else if (isIntersectionQueryEnabled && intersectionsQuery.isLoading) {
    guide = {
      eyebrow: "교차로 확인 중",
      title: "신호등 정보를 불러오고 있어요",
      description: "현재 지도 범위에서 제공되는 교차로를 찾고 있습니다.",
    };
  } else if (isIntersectionQueryEnabled && intersectionErrorMessage) {
    guide = {
      eyebrow: "조회 지연",
      title: "교차로 정보를 가져오지 못했어요",
      description: intersectionErrorMessage,
    };
  } else if (isIntersectionQueryEnabled && intersections.length === 0) {
    guide = {
      eyebrow: "제공 정보 없음",
      title: "이 범위에는 신호 교차로가 없어요",
      description: "지도를 이동하거나 조금 넓혀 다른 지역을 확인해 보세요.",
    };
  } else if (isIntersectionQueryEnabled) {
    guide = {
      eyebrow: `${intersections.length}개 교차로`,
      title: "신호등 마커를 선택해 주세요",
      description:
        "마커를 누르면 해당 교차로의 보행신호와 남은 시간을 확인할 수 있습니다.",
    };
  }

  const serviceBadgeText =
    activeLayer === "restrooms"
      ? !isRestroomQueryEnabled
        ? "ZOOM! ZOOM!"
        : restroomsQuery.isFetching
          ? "화장실 확인 중"
          : `${restrooms.length}개 화장실`
      : activeLayer === "trashBins"
      ? !isTrashBinQueryEnabled
        ? "ZOOM! ZOOM!"
        : trashBinsQuery.isFetching
          ? "휴지통 확인 중"
          : `${trashBins.length}개 휴지통`
      : serviceAreaStatus === "checking"
      ? "지역 확인 중"
        : serviceAreaStatus === "unsupported"
          ? "서비스 준비 중"
          : !isIntersectionQueryEnabled
            ? `ZOOM! ZOOM!`
            : intersectionsQuery.isFetching
              ? "교차로 확인 중"
              : `${intersections.length}개 교차로`;

  return {
    mapContainerRef,
    mapStatus,
    mapErrorMessage,
    locationStatus,
    locationMessage,
    locationMode,
    isCurrentLocationDisabled:
      mapStatus !== "ready" || locationStatus === "locating",
    handleCurrentLocation,
    activeLayer,
    handleLayerChange: (layer: MapLayer) => {
      // 1. 신호 레이어를 떠날 때 선택 교차로를 먼저 해제한다.
      // 보이지 않는 신호 Query와 타이머 팝업이 계속 동작하는 것을 막기 위한 순서다.
      if (layer !== "signals") {
        setSelectedIntersection(null);
      }

      // 화장실 레이어를 벗어나면 상세 팝업과 선택 강조를 함께 해제한다.
      // 다시 돌아왔을 때 이전 화장실이 자동으로 열린 상태가 남지 않게 한다.
      if (layer !== "restrooms") {
        setSelectedRestroom(null);
      }

      // 2. 활성 레이어를 바꾸면 각 Query와 마커 동기화 효과가 한 종류만 남긴다.
      setActiveLayer(layer);
    },
    guide,
    serviceBadgeText,
    selectedIntersection: activeSelectedIntersection,
    selectedRestroom: activeSelectedRestroom,
    signal: signalQuery.data,
    isSignalLoading: signalQuery.isLoading,
    isSignalRefreshing: signalQuery.isFetching && !signalQuery.isLoading,
    signalErrorMessage,
    handleRefreshSignal,
    handleCloseSignal: () => setSelectedIntersection(null),
    handleCloseRestroom: () => setSelectedRestroom(null),
  };
}
