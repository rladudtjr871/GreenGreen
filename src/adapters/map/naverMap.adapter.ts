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
import type { TrashBin } from "@/types/trashBin";
import type { Restroom } from "@/types/restroom";

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

type NaverMarkerIcon = {
  content: string;
  anchor: { x: number; y: number };
};

type NaverMarker = {
  /** 마커를 표시할 지도이며 `null`을 전달하면 지도에서 제거한다. */
  setMap: (map: NaverMap | null) => void;
  /** 마커 HTML과 기준점을 교체한다. */
  setIcon: (icon: NaverMarkerIcon) => void;
  /** 다른 마커와 겹칠 때 사용할 표시 우선순위를 변경한다. */
  setZIndex: (zIndex: number) => void;
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
    /** 마커 모양과 좌표 지점에 맞출 내부 기준점이다. */
    icon: NaverMarkerIcon;
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
  moveTo: (
    coordinate: MapCoordinate,
    updateZoom?: boolean,
    heading?: number | null,
  ) => void;
  /** 현재 위치를 유지한 채 마커의 방향 표현만 갱신한다. */
  setCurrentLocationHeading: (heading: number | null) => void;
  /** 현재 위치 마커를 지도에서 제거한다. */
  clearCurrentLocation: () => void;
  /** SDK 좌표를 프로젝트의 현재 화면 범위와 줌 타입으로 반환한다. */
  getViewport: () => MapViewport;
  /** 지도 이동이 끝난 시점을 구독하며 반환 함수로 구독을 해제한다. */
  onIdle: (listener: () => void) => () => void;
  /** 사용자가 지도를 직접 이동하거나 확대·축소한 시점을 구독한다. */
  onUserMove: (listener: () => void) => () => void;
  /** 현재 조회 범위의 교차로 마커와 선택 상태를 지도에 동기화한다. */
  setIntersections: (
    intersections: Intersection[],
    selectedIntersectionId: string | null,
    selectedSignal: PedestrianSignal | null,
    onSelect: (intersection: Intersection) => void,
  ) => void;
  /** 현재 조회 범위의 휴지통 마커를 지도에 동기화한다. */
  setTrashBins: (trashBins: TrashBin[]) => void;
  /** 현재 조회 범위의 화장실 마커와 선택 상태를 지도에 동기화한다. */
  setRestrooms: (
    restrooms: Restroom[],
    selectedRestroomId: string | null,
    onSelect: (restroom: Restroom) => void,
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

function waitForNaverMapsGeocoder(): Promise<NaverMapsSdk> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 10_000;

    const checkService = () => {
      // 1. 본체 뒤에 비동기로 추가되는 Geocoder 모듈까지 준비됐는지 확인한다.
      // maps.js의 load 이벤트만 기다리면 Service가 아직 없는 짧은 경쟁 상태가 생길 수 있다.
      const sdk = getNaverMapsSdk();

      if (sdk?.Service) {
        resolve(sdk);
        return;
      }

      // 2. 제한 시간 동안만 짧게 재확인한다.
      // 설정 오류나 네트워크 실패 때 초기화 Promise가 영원히 대기하지 않도록 한다.
      if (Date.now() >= deadline) {
        reject(new Error("NAVER Maps Geocoder를 초기화하지 못했습니다."));
        return;
      }

      window.setTimeout(checkService, 50);
    };

    checkService();
  });
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

function escapeMarkerText(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function createTrashBinMarkerContent(name: string | null): string {
  const label = name
    ? `<span style="position:absolute;bottom:38px;left:50%;max-width:220px;padding:7px 10px;overflow:hidden;border:1px solid #d8dcda;border-radius:9px;background:rgba(255,255,255,.96);box-shadow:0 5px 16px rgba(42,48,45,.2);color:#333b37;font-size:12px;font-weight:700;line-height:1.35;text-overflow:ellipsis;white-space:nowrap;transform:translateX(-50%);pointer-events:none">${escapeMarkerText(name)}</span>`
    : "";

  return `<div style="position:relative;width:30px;height:30px">${label}<div aria-hidden="true" style="display:grid;width:30px;height:30px;place-items:center;border:3px solid white;border-radius:11px;background:#68716d;box-shadow:0 5px 14px rgba(43,50,46,.3)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M7 7l1 13h8l1-13"></path><path d="M10 11v5M14 11v5"></path></svg></div></div>`;
}

function createRestroomMarkerContent(isSelected: boolean): string {
  const background = isSelected ? "#125fa8" : "#3979b8";
  const size = isSelected ? 34 : 30;
  const iconSize = isSelected ? 22 : 19;

  return `<div aria-hidden="true" style="display:grid;width:${size}px;height:${size}px;place-items:center;border:3px solid white;border-radius:11px;background:${background};box-shadow:0 5px 14px rgba(28,64,99,.32)"><svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="white"><circle cx="6.5" cy="4.5" r="2.2"></circle><path d="M3.2 9.2c0-1.5 1.2-2.7 2.7-2.7h1.2c1.5 0 2.7 1.2 2.7 2.7v3.9H8.5V21h-4v-7.9H3.2V9.2Z"></path><circle cx="17.5" cy="4.5" r="2.2"></circle><path d="M14.8 9.1c.2-1.5 1.3-2.6 2.7-2.6s2.5 1.1 2.7 2.6l1.1 7h-2V21h-3.6v-4.9h-2l1.1-7Z"></path><rect x="11.35" y="3" width="1.3" height="18" rx=".65" opacity=".72"></rect></svg></div>`;
}

function createCurrentLocationMarkerContent(
  heading: number | null | undefined,
): string {
  // 1. 브라우저가 유효한 이동 방향을 제공하면 북쪽 기준 화살표를 회전한다.
  // heading은 이동 중에만 제공될 수 있으므로 0~360도 범위로 정규화한다.
  if (typeof heading === "number" && Number.isFinite(heading)) {
    const normalizedHeading = ((heading % 360) + 360) % 360;

    return `<div aria-hidden="true" style="display:grid;width:38px;height:38px;place-items:center;transform:rotate(${normalizedHeading}deg)"><svg width="38" height="38" viewBox="0 0 38 38"><path d="M19 2 30 29 19 24 8 29Z" fill="#03c75a" stroke="white" stroke-width="3" stroke-linejoin="round" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,.3))"></path><circle cx="19" cy="20" r="4" fill="white"></circle></svg></div>`;
  }

  // 2. 정지 상태처럼 방향값이 없으면 위치만 나타내는 기존 원형 마커를 사용한다.
  // 지원하지 않는 기기에서도 위치 고정 기능 자체는 그대로 사용할 수 있다.
  return '<div aria-hidden="true" style="width:22px;height:22px;border:4px solid white;border-radius:50%;background:#03c75a;box-shadow:0 2px 10px rgba(0,0,0,.28)"></div>';
}

export function loadNaverMapsSdk(clientId: string): Promise<NaverMapsSdk> {
  // 1. Geocoder까지 로드된 SDK가 있으면 같은 전역 객체를 재사용한다.
  // 페이지 전환이나 재마운트 때 스크립트를 중복 삽입하지 않기 위함이다.
  const loadedSdk = getNaverMapsSdk();

  if (loadedSdk?.Service) {
    return Promise.resolve(loadedSdk);
  }

  // 2. 로딩 중인 Promise도 공유한다.
  // 여러 컴포넌트가 동시에 요청해도 SDK 초기화는 한 번만 수행된다.
  if (sdkLoadingPromise) {
    return sdkLoadingPromise;
  }

  sdkLoadingPromise = new Promise<NaverMapsSdk>((resolve, reject) => {
    const handleLoad = () => {
      // 3. NAVER가 본체 load 뒤에 삽입하는 Geocoder 스크립트까지 기다린다.
      // Reverse Geocoding과 주소 변환이 초기 로드 속도에 따라 실패하지 않게 한다.
      void waitForNaverMapsGeocoder().then(resolve).catch(handleError);
    };

    const handleError = () => {
      sdkLoadingPromise = null;
      reject(new Error("NAVER Maps SDK를 불러오지 못했습니다."));
    };

    // 4. 본체는 로드됐지만 Geocoder만 준비 중이면 해당 모듈만 기다린다.
    if (loadedSdk) {
      void waitForNaverMapsGeocoder().then(resolve).catch(handleError);
      return;
    }

    // 5. 문서에 기존 스크립트가 있다면 완료 이벤트만 이어서 기다린다.
    // 다른 렌더 경로가 먼저 태그를 추가했을 가능성을 안전하게 처리한다.
    const existingScript = document.getElementById(
      NAVER_MAP_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    // 6. 기존 태그가 없을 때만 새 스크립트를 삽입한다.
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
  let selectedTrashBinId: string | null = null;
  const trashBinMarkers = new Map<string, {
    marker: NaverMarker;
    clickListener: NaverEventListener;
    trashBin: TrashBin;
  }>();
  const restroomMarkers = new Map<string, {
    marker: NaverMarker;
    clickListener: NaverEventListener;
    restroom: Restroom;
  }>();

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

  const clearTrashBinMarkers = () => {
    trashBinMarkers.forEach(({ marker, clickListener }) => {
      sdk.Event.removeListener(clickListener);
      marker.setMap(null);
    });
    trashBinMarkers.clear();
  };

  const clearRestroomMarkers = () => {
    restroomMarkers.forEach(({ marker, clickListener }) => {
      sdk.Event.removeListener(clickListener);
      marker.setMap(null);
    });
    restroomMarkers.clear();
  };

  const updateTrashBinMarkerAppearance = (trashBinId: string) => {
    const entry = trashBinMarkers.get(trashBinId);

    if (!entry) {
      return;
    }

    const isSelected = trashBinId === selectedTrashBinId;
    entry.marker.setIcon({
      content: createTrashBinMarkerContent(
        isSelected ? entry.trashBin.name : null,
      ),
      anchor: new sdk.Point(15, 15),
    });
    entry.marker.setZIndex(isSelected ? 80 : 40);
  };

  const addTrashBinMarker = (trashBin: TrashBin) => {
    const isSelected = trashBin.trashBinId === selectedTrashBinId;
    const marker = new sdk.Marker({
      map,
      position: new sdk.LatLng(
        trashBin.coordinate.latitude,
        trashBin.coordinate.longitude,
      ),
      title: `${trashBin.name}${trashBin.trashBinType ? ` · ${trashBin.trashBinType}` : ""}`,
      icon: {
        content: createTrashBinMarkerContent(
          isSelected ? trashBin.name : null,
        ),
        anchor: new sdk.Point(15, 15),
      },
      zIndex: isSelected ? 80 : 40,
    });
    const clickListener = sdk.Event.addListener(marker, "click", () => {
      // 1. 직전에 선택한 마커와 새 선택 마커의 모양만 변경한다.
      // 나머지 마커를 다시 만들지 않아 이름을 열고 닫을 때도 깜빡임을 막는다.
      const previousSelectedTrashBinId = selectedTrashBinId;
      selectedTrashBinId =
        previousSelectedTrashBinId === trashBin.trashBinId
          ? null
          : trashBin.trashBinId;

      if (previousSelectedTrashBinId) {
        updateTrashBinMarkerAppearance(previousSelectedTrashBinId);
      }

      if (selectedTrashBinId) {
        updateTrashBinMarkerAppearance(selectedTrashBinId);
      }
    });

    trashBinMarkers.set(trashBin.trashBinId, {
      marker,
      clickListener,
      trashBin,
    });
  };

  const addRestroomMarker = (
    restroom: Restroom,
    selectedRestroomId: string | null,
    onSelect: (restroom: Restroom) => void,
  ) => {
    const isSelected = restroom.restroomId === selectedRestroomId;
    const markerSize = isSelected ? 34 : 30;
    const marker = new sdk.Marker({
      map,
      position: new sdk.LatLng(
        restroom.coordinate.latitude,
        restroom.coordinate.longitude,
      ),
      title: restroom.name,
      icon: {
        content: createRestroomMarkerContent(isSelected),
        anchor: new sdk.Point(markerSize / 2, markerSize / 2),
      },
      zIndex: isSelected ? 85 : 45,
    });
    const clickListener = sdk.Event.addListener(marker, "click", () => {
      onSelect(restroom);
    });

    restroomMarkers.set(restroom.restroomId, {
      marker,
      clickListener,
      restroom,
    });
  };

  return {
    moveTo(coordinate, updateZoom = true, heading = null) {
      // 1. 프로젝트 좌표를 NAVER 좌표로 변환한 뒤 지도를 이동한다.
      const position = new sdk.LatLng(
        coordinate.latitude,
        coordinate.longitude,
      );

      map.setCenter(position);

      // 2. 최초 현재 위치 이동에서만 권장 줌을 적용한다.
      // 위치 고정 중 GPS가 갱신될 때 사용자가 보고 있던 줌이 반복해서 초기화되지 않게 한다.
      if (updateZoom) {
        map.setZoom(CURRENT_LOCATION_ZOOM, true);
      }

      // 3. 이전 현재 위치 마커를 제거한 뒤 새 위치에 하나만 표시한다.
      // 위치 요청을 반복해도 마커가 지도에 쌓이지 않게 하기 위함이다.
      clearCurrentLocationMarker();
      currentLocationMarker = new sdk.Marker({
        map,
        position,
        title: "현재 위치",
        icon: {
          content: createCurrentLocationMarkerContent(heading),
          anchor: new sdk.Point(
            typeof heading === "number" && Number.isFinite(heading) ? 19 : 15,
            typeof heading === "number" && Number.isFinite(heading) ? 19 : 15,
          ),
        },
        zIndex: 100,
      });
    },
    setCurrentLocationHeading(heading) {
      if (!currentLocationMarker) {
        return;
      }

      // 1. 좌표나 지도 중심은 건드리지 않고 마커 아이콘만 회전시킨다.
      // 방향 센서의 잦은 이벤트가 불필요한 지도 이동으로 이어지지 않게 한다.
      const hasHeading = Number.isFinite(heading);
      currentLocationMarker.setIcon({
        content: createCurrentLocationMarkerContent(heading),
        anchor: new sdk.Point(hasHeading ? 19 : 15, hasHeading ? 19 : 15),
      });
    },
    clearCurrentLocation() {
      clearCurrentLocationMarker();
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

        // 2. 드래그 또는 확대·축소가 시작되면 현재 위치 점을 제거한다.
        // GPS 좌표에 맞춰진 상태가 더는 아니므로 지도 표시부터 원래 상태로 되돌린다.
        clearCurrentLocationMarker();

        // 3. 화면 상태를 관리하는 훅에 사용자 이동을 알린다.
        // 훅은 저장한 GPS 좌표를 비워 버튼의 활성 배경도 함께 해제한다.
        listener();
      };
      const eventListeners = ["dragstart", "touchmove", "pinchstart"].map(
        (eventName) => sdk.Event.addListener(map, eventName, handleUserMove),
      );

      // 4. SDK 지도 이벤트에서 구분하기 어려운 휠·더블클릭 확대도 DOM 입력 시점에 감지한다.
      // 프로그램이 위치를 따라가며 setCenter를 호출하는 동작은 사용자 조작으로 오인하지 않는다.
      container.addEventListener("wheel", handleUserMove, { passive: true });
      container.addEventListener("dblclick", handleUserMove);

      return () => {
        eventListeners.forEach((eventListener) => {
          sdk.Event.removeListener(eventListener);
        });
        container.removeEventListener("wheel", handleUserMove);
        container.removeEventListener("dblclick", handleUserMove);
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
    setTrashBins(trashBins) {
      const nextTrashBinIds = new Set(
        trashBins.map(({ trashBinId }) => trashBinId),
      );

      // 1. 새 지도 범위에서 빠진 마커와 이벤트만 제거한다.
      // 공통 마커를 유지해 범위 조회가 갱신될 때 전체 마커가 깜빡이지 않게 한다.
      trashBinMarkers.forEach(({ marker, clickListener }, trashBinId) => {
        if (nextTrashBinIds.has(trashBinId)) {
          return;
        }

        sdk.Event.removeListener(clickListener);
        marker.setMap(null);
        trashBinMarkers.delete(trashBinId);
      });

      // 2. 선택한 휴지통이 새 범위에서 빠졌다면 이름 표시 상태도 해제한다.
      // 화면 밖 마커의 선택 상태가 다음 범위에 남는 것을 방지한다.
      if (
        selectedTrashBinId &&
        !nextTrashBinIds.has(selectedTrashBinId)
      ) {
        selectedTrashBinId = null;
      }

      // 3. 새 지도 범위에 들어온 마커만 추가한다.
      // 이미 표시 중인 ID는 같은 NAVER 마커 인스턴스를 계속 재사용한다.
      trashBins.forEach((trashBin) => {
        if (!trashBinMarkers.has(trashBin.trashBinId)) {
          addTrashBinMarker(trashBin);
        }
      });
    },
    setRestrooms(restrooms, selectedRestroomId, onSelect) {
      const nextRestroomIds = new Set(
        restrooms.map(({ restroomId }) => restroomId),
      );

      // 1. 새 지도 범위에서 제외된 마커만 제거한다.
      // 공통 마커를 유지해 지도 이동 때 전체 마커가 깜빡이는 현상을 방지한다.
      restroomMarkers.forEach(({ marker, clickListener }, restroomId) => {
        if (nextRestroomIds.has(restroomId)) {
          return;
        }

        sdk.Event.removeListener(clickListener);
        marker.setMap(null);
        restroomMarkers.delete(restroomId);
      });

      // 2. 기존 마커는 선택 여부에 맞춰 아이콘과 우선순위만 갱신한다.
      // React 팝업 상태와 지도 위 강조 상태를 항상 같은 값으로 유지한다.
      restroomMarkers.forEach(({ marker }, restroomId) => {
        const isSelected = restroomId === selectedRestroomId;
        const markerSize = isSelected ? 34 : 30;
        marker.setIcon({
          content: createRestroomMarkerContent(isSelected),
          anchor: new sdk.Point(markerSize / 2, markerSize / 2),
        });
        marker.setZIndex(isSelected ? 85 : 45);
      });

      // 3. 현재 범위에 새로 들어온 화장실만 마커로 추가한다.
      // 같은 ID의 NAVER 마커 인스턴스와 클릭 리스너는 계속 재사용한다.
      restrooms.forEach((restroom) => {
        if (!restroomMarkers.has(restroom.restroomId)) {
          addRestroomMarker(restroom, selectedRestroomId, onSelect);
        }
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
      clearTrashBinMarkers();
      clearRestroomMarkers();
      clearCurrentLocationMarker();
      map.destroy?.();
    },
  };
}
