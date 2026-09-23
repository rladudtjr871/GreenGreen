import {
  CURRENT_LOCATION_ZOOM,
  DEFAULT_MAP_ZOOM,
} from "@/constants/map";
import type { Intersection } from "@/types/intersection";
import type { MapCoordinate, MapRegion, MapViewport } from "@/types/map";
import type {
  PedestrianSignal,
  PedestrianSignalState,
  SignalDirection,
} from "@/types/signal";

const NAVER_MAP_SCRIPT_ID = "naver-maps-sdk";

type CrosswalkMarkerLayout = {
  /** 선택 마커 중앙을 기준으로 횡단보도 막대를 놓을 CSS 위치와 방향이다. */
  style: string;
};

const SIGNAL_GROUP_CROSSWALK_LAYOUTS: Record<
  SignalDirection,
  CrosswalkMarkerLayout
> = {
  // 신호 그룹 방향을 차량 진행 우측에 있는 실제 횡단보도 위치로 회전한다.
  north: { style: "top:35px;left:2px;width:6px;height:22px" },
  northEast: {
    style: "top:13px;left:12px;width:22px;height:6px;transform:rotate(-45deg)",
  },
  east: { style: "top:2px;left:35px;width:22px;height:6px" },
  southEast: {
    style: "top:13px;right:12px;width:22px;height:6px;transform:rotate(45deg)",
  },
  south: { style: "top:35px;right:2px;width:6px;height:22px" },
  southWest: {
    style: "right:12px;bottom:13px;width:22px;height:6px;transform:rotate(-45deg)",
  },
  west: { style: "bottom:2px;left:35px;width:22px;height:6px" },
  northWest: {
    style: "bottom:13px;left:12px;width:22px;height:6px;transform:rotate(45deg)",
  },
};

const SIGNAL_MARKER_STATE_COLORS: Record<PedestrianSignalState, string> = {
  walk: "#05bb55",
  clearance: "#f0a51b",
  stop: "#ed5e5e",
  unknown: "#b8c1bc",
};

type NaverLatLng = {
  /** NAVER 좌표 객체의 위도를 반환한다. */
  lat: () => number;
  /** NAVER 좌표 객체의 경도를 반환한다. */
  lng: () => number;
};

type NaverLatLngBounds = {
  /** 현재 경계의 북동쪽 끝 좌표를 반환한다. */
  getNE: () => NaverLatLng;
  /** 현재 경계의 남서쪽 끝 좌표를 반환한다. */
  getSW: () => NaverLatLng;
};

type NaverEventListener = object;

type NaverReverseGeocodeResponse = {
  v2?: {
    results?: Array<{
      name?: string;
      code?: {
        id?: string;
      };
      region?: {
        area1?: {
          name?: string;
        };
      };
    }>;
  };
};

type NaverMap = {
  /** 지도 중심을 지정된 NAVER 좌표로 이동한다. */
  setCenter: (coordinate: NaverLatLng) => void;
  /** 확대 단계와 전환 효과 사용 여부를 설정한다. */
  setZoom: (zoom: number, useEffect?: boolean) => void;
  /** 현재 지도 확대 단계를 반환한다. */
  getZoom: () => number;
  /** 현재 화면에 보이는 지도 경계를 반환한다. */
  getBounds: () => NaverLatLngBounds;
  /** SDK가 지원하는 경우 지도 인스턴스와 내부 리소스를 해제한다. */
  destroy?: () => void;
};

type NaverMarker = {
  /** 마커를 표시할 지도이며 `null`을 전달하면 지도에서 제거한다. */
  setMap: (map: NaverMap | null) => void;
};

type NaverMapsSdk = {
  /** 프로젝트 좌표를 NAVER 지도 좌표 객체로 만드는 생성자다. */
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  /** 지도 DOM과 표시 옵션으로 NAVER 지도 인스턴스를 만드는 생성자다. */
  Map: new (
    container: HTMLElement,
    options: {
      /** 지도를 처음 표시할 중심 좌표다. */
      center: NaverLatLng;
      /** 지도를 처음 표시할 확대 단계다. */
      zoom: number;
      /** 사용자가 축소할 수 있는 최소 확대 단계다. */
      minZoom: number;
      /** NAVER 기본 확대·축소 UI의 표시 여부다. */
      zoomControl: boolean;
      /** 마우스 휠을 이용한 확대·축소 허용 여부다. */
      scrollWheel: boolean;
      /** 터치 화면의 두 손가락 확대·축소 허용 여부다. */
      pinchZoom: boolean;
      /** NAVER 기본 축척 UI의 표시 여부다. */
      scaleControl: boolean;
      /** NAVER 로고의 표시 여부다. */
      logoControl: boolean;
      /** 지도 데이터 저작권 UI의 표시 여부다. */
      mapDataControl: boolean;
    },
  ) => NaverMap;
  /** 지도 위에 사용자 정의 마커를 만드는 생성자다. */
  Marker: new (options: {
    /** 마커를 표시할 지도 인스턴스다. */
    map: NaverMap;
    /** 마커를 배치할 NAVER 좌표다. */
    position: NaverLatLng;
    /** 마커의 접근성 및 기본 설명에 사용하는 이름이다. */
    title: string;
    /** SDK가 렌더링할 사용자 정의 HTML 아이콘 설정이다. */
    icon: {
      /** 마커 모양으로 렌더링할 HTML 문자열이다. */
      content: string;
      /** 좌표 지점에 맞출 아이콘 내부 기준점이다. */
      anchor: { x: number; y: number };
    };
    /** 겹친 마커 사이의 표시 우선순위다. */
    zIndex: number;
  }) => NaverMarker;
  /** 마커 기준점에 사용하는 NAVER 픽셀 좌표 생성자다. */
  Point: new (x: number, y: number) => { x: number; y: number };
  /** NAVER 지도와 마커 이벤트를 등록하고 해제하는 API다. */
  Event: {
    /** 대상의 지정 이벤트를 구독하고 해제에 필요한 리스너 참조를 반환한다. */
    addListener: (
      target: object,
      eventName: string,
      listener: () => void,
    ) => NaverEventListener;
    /** 앞서 등록한 이벤트 리스너를 해제한다. */
    removeListener: (listener: NaverEventListener) => void;
  };
  /** Geocoder 서브모듈이 제공하는 좌표 기반 주소 검색 API다. */
  Service?: {
    Status: {
      OK: number;
    };
    OrderType: {
      LEGAL_CODE: string;
    };
    reverseGeocode: (
      options: {
        coords: NaverLatLng;
        orders: string;
      },
      callback: (
        status: number,
        response?: NaverReverseGeocodeResponse,
      ) => void,
    ) => void;
  };
};

type NaverWindow = Window &
  typeof globalThis & {
    /** SDK 스크립트 로드가 끝난 뒤 브라우저 전역에 제공되는 NAVER 객체다. */
    naver?: {
      /** 이 어댑터에서 사용하는 NAVER Maps SDK API 모음이다. */
      maps: NaverMapsSdk;
    };
  };

export type NaverMapController = {
  /** 지도를 지정 좌표로 이동하고 현재 위치 마커를 갱신한다. */
  moveTo: (coordinate: MapCoordinate) => void;
  /** SDK 좌표를 프로젝트의 현재 화면 범위와 줌 타입으로 반환한다. */
  getViewport: () => MapViewport;
  /** 지도 이동이 끝난 시점을 구독하며 반환 함수로 구독을 해제한다. */
  onIdle: (listener: () => void) => () => void;
  /** 사용자가 지도를 직접 드래그한 시점을 구독하며 현재 위치 표시를 함께 해제한다. */
  onUserMove: (listener: () => void) => () => void;
  /** 현재 조회 범위의 교차로 마커와 선택 상태를 지도에 동기화한다. */
  setIntersections: (
    intersections: Intersection[],
    selectedIntersectionId: string | null,
    selectedSignal: PedestrianSignal | null,
    onSelect: (intersection: Intersection) => void,
  ) => void;
  /** 좌표를 법정동 기준 광역 지역 정보로 변환한다. */
  resolveRegion: (coordinate: MapCoordinate) => Promise<MapRegion | null>;
  /** 어댑터가 만든 이벤트, 마커, 지도 인스턴스를 정리한다. */
  destroy: () => void;
};

let sdkLoadingPromise: Promise<NaverMapsSdk> | null = null;

function getNaverMapsSdk(): NaverMapsSdk | undefined {
  return (window as NaverWindow).naver?.maps;
}

function createIntersectionMarkerContent(
  isSelected: boolean,
  selectedSignal: PedestrianSignal | null,
): string {
  const markerSize = isSelected ? 34 : 30;
  const markerColor = isSelected ? "#03a94d" : "#173b2a";
  const trafficLight = `<div style="display:grid;width:${markerSize}px;height:${markerSize}px;place-items:center;border:3px solid white;border-radius:12px;background:${markerColor};box-shadow:0 5px 14px rgba(20,49,34,.28)"><div style="display:flex;gap:2px"><span style="width:4px;height:4px;border-radius:50%;background:#ff7272"></span><span style="width:4px;height:4px;border-radius:50%;background:#ffd166"></span><span style="width:4px;height:4px;border-radius:50%;background:#41ed89"></span></div></div>`;

  if (
    !isSelected ||
    !selectedSignal ||
    selectedSignal.isStale ||
    selectedSignal.directions.length === 0
  ) {
    return trafficLight;
  }

  // 1. 차량 진입 기준의 신호 그룹을 연결된 횡단보도 위치의 막대로 변환한다.
  // 예를 들어 북쪽 신호 그룹은 교차로 서측 횡단보도이므로 마커 왼쪽에 세로로 둔다.
  const crosswalkBars = selectedSignal.directions
    .map(({ direction, state }) => {
      const layout = SIGNAL_GROUP_CROSSWALK_LAYOUTS[direction];
      const color = SIGNAL_MARKER_STATE_COLORS[state];
      const glow =
        state === "walk"
          ? "0 0 0 3px rgba(5,187,85,.2),0 0 12px rgba(5,187,85,.75)"
          : "0 2px 5px rgba(20,49,34,.22)";

      return `<span aria-hidden="true" style="position:absolute;display:block;box-sizing:content-box;${layout.style};border:2px solid white;border-radius:999px;background:${color};box-shadow:${glow}"></span>`;
    })
    .join("");

  // 2. 기존 신호등을 중앙에 두고 횡단보도 막대를 둘레에 합성한다.
  // 선택한 마커만 확장해 주변의 다른 교차로 마커를 가리지 않도록 한다.
  return `<div style="position:relative;width:92px;height:92px"><div style="position:absolute;top:29px;left:29px">${trafficLight}</div>${crosswalkBars}</div>`;
}

export function loadNaverMapsSdk(clientId: string): Promise<NaverMapsSdk> {
  // 1. 이미 로드된 SDK가 있으면 같은 전역 객체를 재사용한다.
  // 페이지 전환이나 재마운트 때 스크립트를 중복 삽입하지 않기 위함이다.
  const loadedSdk = getNaverMapsSdk();

  if (loadedSdk) {
    return Promise.resolve(loadedSdk);
  }

  // 2. 로딩 중인 Promise도 공유한다.
  // 여러 컴포넌트가 동시에 요청해도 SDK 초기화는 한 번만 수행된다.
  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  sdkLoadingPromise = new Promise<NaverMapsSdk>((resolve, reject) => {
    const handleLoad = () => {
      const sdk = getNaverMapsSdk();

      if (sdk) {
        resolve(sdk);
        return;
      }

      sdkLoadingPromise = null;
      reject(new Error("NAVER Maps SDK를 초기화하지 못했습니다."));
    };

    const handleError = () => {
      sdkLoadingPromise = null;
      reject(new Error("NAVER Maps SDK를 불러오지 못했습니다."));
    };

    // 3. 문서에 기존 스크립트가 있다면 완료 이벤트만 이어서 기다린다.
    // 다른 렌더 경로가 먼저 태그를 추가했을 가능성을 안전하게 처리한다.
    const existingScript = document.getElementById(
      NAVER_MAP_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    // 4. 기존 태그가 없을 때만 새 스크립트를 삽입한다.
    // Client ID는 URL 구성 요소이므로 인코딩해 쿼리 문자열을 보존한다.
    const script = document.createElement("script");
    script.id = NAVER_MAP_SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    script.async = true;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });

  return sdkLoadingPromise;
}

export function createNaverMap(
  container: HTMLElement,
  initialCoordinate: MapCoordinate,
  sdk: NaverMapsSdk,
): NaverMapController {
  // NAVER SDK 타입과 옵션은 이 어댑터 안에서만 사용해 상위 로직의 지도 종속성을 줄인다.
  const map = new sdk.Map(container, {
    center: new sdk.LatLng(
      initialCoordinate.latitude,
      initialCoordinate.longitude,
    ),
    zoom: DEFAULT_MAP_ZOOM,
    minZoom: 8,
    zoomControl: false,
    scrollWheel: true,
    pinchZoom: true,
    scaleControl: false,
    logoControl: true,
    mapDataControl: false,
  });

  let currentLocationMarker: NaverMarker | null = null;
  let intersectionMarkers: Array<{
    marker: NaverMarker;
    clickListener: NaverEventListener;
  }> = [];

  const clearCurrentLocationMarker = () => {
    currentLocationMarker?.setMap(null);
    currentLocationMarker = null;
  };

  const clearIntersectionMarkers = () => {
    // 마커뿐 아니라 각 클릭 리스너도 함께 제거해야 재조회 시 핸들러가 누적되지 않는다.
    intersectionMarkers.forEach(({ marker, clickListener }) => {
      sdk.Event.removeListener(clickListener);
      marker.setMap(null);
    });
    intersectionMarkers = [];
  };

  return {
    moveTo(coordinate) {
      // 1. 프로젝트 좌표를 NAVER 좌표로 변환한 뒤 지도를 이동한다.
      const position = new sdk.LatLng(
        coordinate.latitude,
        coordinate.longitude,
      );

      map.setCenter(position);
      map.setZoom(CURRENT_LOCATION_ZOOM, true);

      // 2. 이전 현재 위치 마커를 제거한 뒤 새 위치에 하나만 표시한다.
      // 위치 요청을 반복해도 마커가 지도에 쌓이지 않게 하기 위함이다.
      clearCurrentLocationMarker();
      currentLocationMarker = new sdk.Marker({
        map,
        position,
        title: "현재 위치",
        icon: {
          content:
            '<div aria-hidden="true" style="width:22px;height:22px;border:4px solid white;border-radius:50%;background:#03c75a;box-shadow:0 2px 10px rgba(0,0,0,.28)"></div>',
          anchor: new sdk.Point(15, 15),
        },
        zIndex: 100,
      });
    },
    getViewport() {
      // SDK 경계 객체를 즉시 프로젝트 타입으로 변환해 외부로 노출하지 않는다.
      const bounds = map.getBounds();
      const northEast = bounds.getNE();
      const southWest = bounds.getSW();

      return {
        zoom: map.getZoom(),
        bounds: {
          north: northEast.lat(),
          east: northEast.lng(),
          south: southWest.lat(),
          west: southWest.lng(),
        },
      };
    },
    onIdle(listener) {
      const eventListener = sdk.Event.addListener(map, "idle", listener);
      return () => sdk.Event.removeListener(eventListener);
    },
    onUserMove(listener) {
      const handleUserMove = () => {
        // 1. 현재 위치 표시가 이미 해제됐다면 반복되는 터치 이동 이벤트를 무시한다.
        // touchmove는 손가락을 움직이는 동안 여러 번 발생하므로 최초 한 번만 상태를 갱신한다.
        if (!currentLocationMarker) {
          return;
        }

        // 2. 마우스 드래그, 한 손가락 이동, 두 손가락 확대·축소가 시작되면 현재 위치 점을 제거한다.
        // GPS 좌표에 맞춰진 상태가 더는 아니므로 지도 표시부터 원래 상태로 되돌린다.
        clearCurrentLocationMarker();

        // 3. 화면 상태를 관리하는 훅에 사용자 이동을 알린다.
        // 훅은 저장한 GPS 좌표를 비워 버튼의 활성 배경도 함께 해제한다.
        listener();
      };
      const eventListeners = ["dragstart", "touchmove", "pinchstart"].map(
        (eventName) => sdk.Event.addListener(map, eventName, handleUserMove),
      );

      return () => {
        eventListeners.forEach((eventListener) => {
          sdk.Event.removeListener(eventListener);
        });
      };
    },
    setIntersections(
      intersections,
      selectedIntersectionId,
      selectedSignal,
      onSelect,
    ) {
      // 1. 현재 범위의 결과를 완전히 교체한다.
      // 이동 전 범위의 마커와 새 결과가 섞이는 것을 방지한다.
      clearIntersectionMarkers();

      // 2. 선택 상태를 반영해 마커를 만들고 클릭 이벤트를 연결한다.
      // 리스너 참조를 보관해야 다음 교체나 destroy 시 정확히 해제할 수 있다.
      intersectionMarkers = intersections.map((intersection) => {
        const isSelected =
          intersection.intersectionId === selectedIntersectionId;
        const markerSignal =
          isSelected &&
          selectedSignal?.intersectionId === intersection.intersectionId
            ? selectedSignal
            : null;
        const hasSignalDirections =
          markerSignal !== null && markerSignal.directions.length > 0;
        const marker = new sdk.Marker({
          map,
          position: new sdk.LatLng(
            intersection.coordinate.latitude,
            intersection.coordinate.longitude,
          ),
          title: intersection.name,
          icon: {
            content: createIntersectionMarkerContent(isSelected, markerSignal),
            anchor: new sdk.Point(
              isSelected && hasSignalDirections ? 46 : isSelected ? 17 : 15,
              isSelected && hasSignalDirections ? 46 : isSelected ? 17 : 15,
            ),
          },
          zIndex: isSelected ? 90 : 50,
        });
        const clickListener = sdk.Event.addListener(marker, "click", () => {
          onSelect(intersection);
        });

        return { marker, clickListener };
      });
    },
    resolveRegion(coordinate) {
      return new Promise((resolve, reject) => {
        const service = sdk.Service;

        // 1. Geocoder 서브모듈 준비 여부를 확인한다.
        // 지도 표시 자체는 유지하되 지역 판별만 실패로 처리할 수 있도록 별도 오류로 구분한다.
        if (!service) {
          reject(new Error("NAVER Reverse Geocoding을 사용할 수 없습니다."));
          return;
        }

        // 2. 프로젝트 좌표를 NAVER 좌표로 변환해 법정동 결과만 요청한다.
        // 도로명·행정동 결과를 함께 받지 않아 응답에서 사용할 코드가 모호해지는 일을 막는다.
        service.reverseGeocode(
          {
            coords: new sdk.LatLng(
              coordinate.latitude,
              coordinate.longitude,
            ),
            orders: service.OrderType.LEGAL_CODE,
          },
          (status, response) => {
            if (status !== service.Status.OK) {
              reject(new Error("현재 지도 지역을 확인할 수 없습니다."));
              return;
            }

            // 3. 법정동 결과에서 서비스 지역 판별에 필요한 코드와 시·도명만 추출한다.
            // 결과가 없는 해상 좌표 등은 오류가 아니라 판별 불가 상태로 상위 로직에 전달한다.
            const legalRegion = response?.v2?.results?.find(
              ({ name }) => name === "legalcode",
            );
            const legalCode = legalRegion?.code?.id?.trim();

            if (!legalCode) {
              resolve(null);
              return;
            }

            resolve({
              legalCode,
              area1Name: legalRegion?.region?.area1?.name?.trim() ?? "",
            });
          },
        );
      });
    },
    destroy() {
      // 컴포넌트 해제 시 어댑터가 소유한 마커와 지도 인스턴스를 모두 정리한다.
      clearIntersectionMarkers();
      clearCurrentLocationMarker();
      map.destroy?.();
    },
  };
}
