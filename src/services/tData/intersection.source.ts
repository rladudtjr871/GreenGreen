import latestIntersectionRecords from "@/data/intersections-20260922.json";
import legacyIntersectionRecords from "@/data/intersections.json";

type IntersectionSnapshotRecord = {
  itstId: string;
  itstNm: string;
  mapCtptIntLat: number;
  mapCtptIntLot: number;
};

const INTERSECTION_DATA_SOURCES = {
  legacy: legacyIntersectionRecords,
  latest: latestIntersectionRecords,
} satisfies Record<string, readonly IntersectionSnapshotRecord[]>;

export type IntersectionDataSource = keyof typeof INTERSECTION_DATA_SOURCES;

const DEFAULT_INTERSECTION_DATA_SOURCE: IntersectionDataSource = "latest";

function isIntersectionDataSource(
  value: string,
): value is IntersectionDataSource {
  return value in INTERSECTION_DATA_SOURCES;
}

export function getIntersectionSnapshot(): readonly IntersectionSnapshotRecord[] {
  // 1. 서버 환경변수가 없으면 최신 스냅샷을 기본으로 선택한다.
  // 새 배포에서는 추가 설정 없이 최신 데이터를 사용하기 위한 기본값이다.
  const configuredSource =
    process.env.TDATA_INTERSECTION_SOURCE?.trim() ||
    DEFAULT_INTERSECTION_DATA_SOURCE;

  // 2. 등록되지 않은 소스 이름은 즉시 오류로 알려 잘못된 데이터로 조용히 대체되지 않게 한다.
  // 롤백은 `legacy`, 최신 데이터 복귀는 `latest`라는 명시적인 값으로만 수행한다.
  if (!isIntersectionDataSource(configuredSource)) {
    throw new Error(
      `지원하지 않는 교차로 데이터 소스입니다: ${configuredSource}`,
    );
  }

  return INTERSECTION_DATA_SOURCES[configuredSource];
}
