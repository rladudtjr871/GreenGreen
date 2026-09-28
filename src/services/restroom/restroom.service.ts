import restroomSnapshot from "@/data/restrooms.json";
import type { MapBounds } from "@/types/map";
import type { Restroom } from "@/types/restroom";

const restrooms: Restroom[] = restroomSnapshot;

export async function getRestroomsInBounds(
  bounds: MapBounds,
): Promise<Restroom[]> {
  // 1. 정적 스냅샷에서 현재 지도 경계에 포함되는 화장실만 고른다.
  // 브라우저에 4천여 건 전체를 전달하지 않아 응답과 마커 생성 비용을 줄인다.
  return restrooms.filter(({ coordinate }) => {
    const { latitude, longitude } = coordinate;
    return (
      latitude <= bounds.north &&
      latitude >= bounds.south &&
      longitude <= bounds.east &&
      longitude >= bounds.west
    );
  });
}
