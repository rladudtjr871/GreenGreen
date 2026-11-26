import type { MapCoordinate } from "@/types/map";

export const SEOUL_CITY_HALL_COORDINATE: MapCoordinate = {
  latitude: 37.5666103,
  longitude: 126.9783882,
};

export const DEFAULT_MAP_ZOOM = 15;
export const CURRENT_LOCATION_ZOOM = 17;
export const MAP_DATA_QUERY_MIN_ZOOM = 16;
export const INTERSECTION_QUERY_MIN_ZOOM = MAP_DATA_QUERY_MIN_ZOOM;
export const TRASH_BIN_QUERY_MIN_ZOOM = MAP_DATA_QUERY_MIN_ZOOM;
export const RESTROOM_QUERY_MIN_ZOOM = MAP_DATA_QUERY_MIN_ZOOM;
export const MAP_IDLE_DEBOUNCE_MS = 400;
export const SEOUL_LEGAL_CODE_PREFIX = "11";

/** NAVER 지도(Web Mercator)의 한 타일 크기(px)로, 확대 단계별 화면 범위 계산에 사용한다. */
export const MAP_TILE_SIZE_PX = 256;
/** 지도 데이터 조회에서 허용하는 최대 화면 크기(CSS px)로, 4K 모니터 전체 화면까지 수용한다. */
export const MAP_DATA_QUERY_MAX_VIEWPORT_PX = 3_840;
/** 클라이언트 조회 최소 확대 단계에서 최대 화면이 차지하는 경도·위도 폭(도)으로, 서버 범위 검사의 상한이다. */
export const MAP_DATA_QUERY_MAX_SPAN_DEGREES =
  (MAP_DATA_QUERY_MAX_VIEWPORT_PX * 360) /
  (MAP_TILE_SIZE_PX * 2 ** MAP_DATA_QUERY_MIN_ZOOM);
