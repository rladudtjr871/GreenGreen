import type { Intersection } from "@/types/intersection";

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapTDataIntersection(
  record: Record<string, unknown>,
): Intersection | null {
  // 1. 외부 필드의 ID와 좌표를 내부 타입으로 변환한다.
  const intersectionId = String(record.itstId ?? "").trim();
  const latitude = toFiniteNumber(record.mapCtptIntLat);
  const longitude = toFiniteNumber(record.mapCtptIntLot);

  // 2. 필수 값과 지리 좌표 범위를 검증한다.
  // 잘못된 스냅샷 한 행이 지도 SDK의 전체 마커 생성을 깨뜨리지 않게 제외한다.
  if (
    !intersectionId ||
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  // 3. 이름이 비어 있어도 식별 가능한 대체 이름을 제공한다.
  const name = String(record.itstNm ?? "").trim();

  return {
    intersectionId,
    name: name || `교차로 ${intersectionId}`,
    coordinate: { latitude, longitude },
  };
}
