import type { MapCoordinate } from "@/types/map";

export type Intersection = {
  /** T-Data에서 교차로를 구분하는 고유 식별자다. */
  intersectionId: string;
  /** 지도 마커와 신호 상세에 표시하는 교차로 이름이다. */
  name: string;
  /** 지도에 교차로 마커를 배치할 중심 좌표다. */
  coordinate: MapCoordinate;
};
