import { mapTDataPedestrianSignal } from "@/services/tData/signal.mapper";
import { fetchTDataRecords } from "@/services/tData/tData.client";
import type { PedestrianSignal } from "@/types/signal";

const SIGNAL_ENDPOINT = "v2xSignalPhaseTimingFusionCurrentInfo/1.0";

export async function getPedestrianSignal(
  intersectionId: string,
): Promise<PedestrianSignal | null> {
  // 1. 선택된 교차로 한 건만 요청하고 캐시하지 않는다.
  // 실시간 신호가 이전 응답으로 대체되는 일을 막기 위한 설정이다.
  const records = await fetchTDataRecords(
    SIGNAL_ENDPOINT,
    "apikey",
    {
      itstId: intersectionId,
      type: "json",
      pageNo: "1",
      numOfRows: "1",
    },
    0,
  );
console.log('recordsrecordsrecords', records)
  // 2. 외부 레코드가 있을 때만 내부 모델로 변환한다.
  // 빈 응답은 Route Handler가 404로 구분할 수 있도록 null로 유지한다.
  const record = records[0];
  return record
    ? mapTDataPedestrianSignal(record, intersectionId)
    : null;
}
