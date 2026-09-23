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
  SEOUL_CITY_HALL_COORDINATE,
  SEOUL_LEGAL_CODE_PREFIX,
} from "@/constants/map";
import { SIGNAL_STALE_AFTER_MS } from "@/constants/signal";
import {
  fetchIntersections,
  fetchPedestrianSignal,
} from "@/services/greenGreenApi";
import type { Intersection } from "@/types/intersection";
import type {
  MapBounds,
  MapCoordinate,
  MapRegion,
  MapViewport,
} from "@/types/map";

type MapStatus = "loading" | "ready" | "error";
type LocationStatus = "idle" | "locating" | "error";
type ServiceAreaStatus =
  | "checking"
  | "supported"
  | "unsupported"
  | "unknown";

const NAVER_MAP_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
const MISSING_CLIENT_ID_MESSAGE =
  "NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 환경변수를 설정해 주세요.";

const LOCATION_ERROR_MESSAGES: Record<number, string> = {
  1: "위치 권한이 필요합니다. 브라우저 설정에서 위치 권한을 허용해 주세요.",
  2: "현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  3: "위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.",
};

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
  const [mapStatus, setMapStatus] = useState<MapStatus>(
    NAVER_MAP_CLIENT_ID ? "loading" : "error",
  );
  const [mapErrorMessage, setMapErrorMessage] = useState(
    NAVER_MAP_CLIENT_ID ? "" : MISSING_CLIENT_ID_MESSAGE,
  );
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [selectedIntersection, setSelectedIntersection] =
    useState<Intersection | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState("");
  const [currentLocationCoordinate, setCurrentLocationCoordinate] =
    useState<MapCoordinate | null>(null);
  const [serviceAreaStatus, setServiceAreaStatus] =
    useState<ServiceAreaStatus>("checking");
  const [unsupportedRegionName, setUnsupportedRegionName] = useState("");

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
          setCurrentLocationCoordinate(null);
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
      mapControllerRef.current?.destroy();
      mapControllerRef.current = null;
    };
  }, []);

  const normalizedBounds = useMemo(
    () => (viewport ? normalizeBounds(viewport.bounds) : null),
    [viewport],
  );
  // 1. 지도 준비 여부와 줌 임계값을 먼저 확인한다.
  // 범위 쿼리를 비활성화해 멀리서 불필요한 교차로 데이터를 가져오지 않는다.
  const isIntersectionQueryEnabled =
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

  const handleSelectIntersection = useCallback(
    (intersection: Intersection) => setSelectedIntersection(intersection),
    [],
  );
  const activeSelectedIntersection = isIntersectionQueryEnabled
    ? selectedIntersection
    : null;

  const signalQuery = useQuery({
    // 3. 사용자가 선택한 교차로만 실시간 신호를 조회한다.
    // 정기 폴링 없이 잔여시간이 끝날 때만 재조회해 외부 API 호출량을 제한한다.
    queryKey: ["signal", activeSelectedIntersection?.intersectionId],
    queryFn: () =>
      activeSelectedIntersection
        ? fetchPedestrianSignal(activeSelectedIntersection.intersectionId)
        : Promise.reject(new Error("교차로가 선택되지 않았습니다.")),
    enabled: activeSelectedIntersection !== null,
    staleTime: 3_000,
  });
  const refetchSignal = signalQuery.refetch;
  const handleSignalRemainingTimeEnd = useCallback(() => {
    // 0초 도달 후 재시도가 겹치면 진행 중인 요청을 취소하지 않고 기존 요청을 공유한다.
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
    const observedTime = signal
      ? new Date(signal.observedAt).getTime()
      : Number.NaN;
    const isSignalFresh =
      signal !== null &&
      !signal.isStale &&
      Number.isFinite(observedTime) &&
      Date.now() - observedTime <= SIGNAL_STALE_AFTER_MS;
    const visibleSignal = isSignalFresh ? signal : null;

    // 4. 교차로와 선택 신호를 함께 전달해 선택 마커의 방향 상태를 갱신한다.
    // 줌이 임계값 아래이거나 신호가 오래되면 방향 강조를 즉시 제거한다.
    controller.setIntersections(
      visibleIntersections,
      selectedIntersectionId,
      visibleSignal,
      handleSelectIntersection,
    );

    if (!visibleSignal) {
      return;
    }

    // 5. 다음 폴링이 실패해도 관측 시각이 stale 기준을 넘으면 방향 색상을 제거한다.
    // 오래된 보행 가능 화살표가 지도에 계속 남는 안전 문제를 방지한다.
    const staleTimer = window.setTimeout(() => {
      controller.setIntersections(
        visibleIntersections,
        selectedIntersectionId,
        null,
        handleSelectIntersection,
      );
    }, Math.max(0, observedTime + SIGNAL_STALE_AFTER_MS - Date.now()));

    return () => window.clearTimeout(staleTimer);
  }, [
    activeSelectedIntersection?.intersectionId,
    handleSelectIntersection,
    intersectionsQuery.data,
    isIntersectionQueryEnabled,
    signalQuery.data,
  ]);

  const handleCurrentLocation = useCallback(() => {
    // 1. 브라우저와 지도 준비 상태를 확인한다.
    // 위치 권한을 요청한 뒤 지도가 없어 결과를 쓰지 못하는 상황을 피한다.
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("이 브라우저는 현재 위치 기능을 지원하지 않습니다.");
      return;
    }

    if (!mapControllerRef.current) {
      return;
    }

    setLocationStatus("locating");
    setLocationMessage("");
    setCurrentLocationCoordinate(null);

    // 2. 위치를 얻은 뒤에만 지도 이동과 성공 상태를 함께 반영한다.
    // 실패 콜백에서는 브라우저 오류 코드를 사용자 메시지로 변환한다.
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinate: MapCoordinate = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        mapControllerRef.current?.moveTo(coordinate);
        setCurrentLocationCoordinate(coordinate);
        setLocationStatus("idle");
        setLocationMessage("");
      },
      ({ code }) => {
        setCurrentLocationCoordinate(null);
        setLocationStatus("error");
        setLocationMessage(
          LOCATION_ERROR_MESSAGES[code] ??
            "현재 위치를 확인하는 중 문제가 발생했습니다.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      },
    );
  }, []);

  const intersections = intersectionsQuery.data ?? [];
  const intersectionErrorMessage =
    intersectionsQuery.error instanceof Error
      ? intersectionsQuery.error.message
      : "";
  const signalErrorMessage =
    signalQuery.error instanceof Error ? signalQuery.error.message : "";

  let guide = {
    eyebrow: `ZOOM! ZOOM!`,
    title: "지도를 조금 더 확대해 주세요",
    description:
      "신호 제공 교차로를 정확하게 표시하기 위해 가까운 지도에서만 정보를 불러옵니다.",
  };

  // 조회 가능 여부를 먼저 본 뒤 로딩, 오류, 빈 결과, 성공 순으로 안내한다.
  // 동시에 여러 상태가 참이어도 사용자에게 가장 우선적인 상태 하나만 보여준다.
  if (serviceAreaStatus === "checking") {
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
    serviceAreaStatus === "checking"
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
    isCurrentLocationActive: currentLocationCoordinate !== null,
    isCurrentLocationDisabled:
      mapStatus !== "ready" || locationStatus === "locating",
    handleCurrentLocation,
    guide,
    serviceBadgeText,
    selectedIntersection: activeSelectedIntersection,
    signal: signalQuery.data,
    isSignalLoading: signalQuery.isLoading,
    isSignalRefreshing: signalQuery.isFetching && !signalQuery.isLoading,
    signalErrorMessage,
    handleSignalRemainingTimeEnd,
    handleCloseSignal: () => setSelectedIntersection(null),
  };
}
