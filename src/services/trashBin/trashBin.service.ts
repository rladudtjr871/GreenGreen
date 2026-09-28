import trashBinV2Snapshot from "@/data/trashBins-v2.json";
import trashBinV1Snapshot from "@/data/trashBins.json";
import type { MapBounds } from "@/types/map";
import type { TrashBin, TrashBinDataVersion } from "@/types/trashBin";

const trashBinsByVersion: Record<TrashBinDataVersion, TrashBin[]> = {
  v1: trashBinV1Snapshot,
  v2: trashBinV2Snapshot,
};

export async function getTrashBinsInBounds(
  bounds: MapBounds,
  version: TrashBinDataVersion,
): Promise<TrashBin[]> {
  // 1. 정규화된 스냅샷 중 현재 지도 경계에 포함되는 행만 고른다.
  // 선택한 버전의 전체 데이터를 브라우저에 보내지 않아 전송량과 마커 생성 비용을 제한한다.
  return trashBinsByVersion[version].filter(({ coordinate }) => {
    const { latitude, longitude } = coordinate;
    return (
      latitude <= bounds.north &&
      latitude >= bounds.south &&
      longitude <= bounds.east &&
      longitude >= bounds.west
    );
  });
}
