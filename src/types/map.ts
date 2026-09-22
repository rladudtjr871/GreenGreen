export type MapCoordinate = {
  /** WGS84 기준 위도이며 단위는 십진 도(degree)다. */
  latitude: number;
  /** WGS84 기준 경도이며 단위는 십진 도(degree)다. */
  longitude: number;
};

export type MapBounds = {
  /** 지도 화면의 북쪽 끝 위도다. */
  north: number;
  /** 지도 화면의 동쪽 끝 경도다. */
  east: number;
  /** 지도 화면의 남쪽 끝 위도다. */
  south: number;
  /** 지도 화면의 서쪽 끝 경도다. */
  west: number;
};

export type MapViewport = {
  /** 현재 지도 화면에 보이는 지리적 경계다. */
  bounds: MapBounds;
  /** 현재 NAVER 지도 확대 단계다. 값이 클수록 더 확대된 화면이다. */
  zoom: number;
};
