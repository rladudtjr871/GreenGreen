import intersectionRecords from "@/data/intersections.json";
import { mapTDataIntersection } from "@/services/tData/intersection.mapper";
import type { Intersection } from "@/types/intersection";
import type { MapBounds } from "@/types/map";

const intersections: Intersection[] = intersectionRecords
  // 1. 서버 시작 시 공식 스냅샷을 내부 모델로 한 번 변환한다.
  // 외부 API의 장시간 반복 호출 제한을 피하면서 매 요청의 변환 비용도 줄인다.
  .map((record) => mapTDataIntersection(record))
  .filter((intersection): intersection is Intersection => intersection !== null);

export async function getIntersectionsInBounds(
  bounds: MapBounds,
): Promise<Intersection[]> {
  // 2. 정규화된 지도 경계 안의 교차로만 반환한다.
  // 클라이언트로 전체 스냅샷을 보내지 않아 전송량과 마커 생성량을 제한한다.
  return intersections.filter(({ coordinate }) => {
    const { latitude, longitude } = coordinate;
    return (
      latitude <= bounds.north &&
      latitude >= bounds.south &&
      longitude <= bounds.east &&
      longitude >= bounds.west
    );
  });
}
