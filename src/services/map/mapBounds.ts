import { MAP_DATA_QUERY_MAX_SPAN_DEGREES } from "@/constants/map";
import type { MapBounds } from "@/types/map";

/** 클라이언트가 bounds를 약 10m 단위로 반올림하므로 그만큼의 오차를 범위 상한에 더한다. */
const BOUNDS_NORMALIZATION_TOLERANCE_DEGREES = 0.0002;

export type MapBoundsQueryResult =
  | {
      /** 검증을 통과했는지 나타낸다. */
      ok: true;
      /** 검증된 지도 경계다. */
      bounds: MapBounds;
    }
  | {
      /** 검증을 통과했는지 나타낸다. */
      ok: false;
      /** 클라이언트에 그대로 반환할 사용자용 오류 메시지다. */
      message: string;
    };

/** 쿼리 문자열 값을 유한한 숫자로 변환하고 실패하면 null을 반환한다. */
function parseCoordinate(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 쿼리 문자열의 지도 경계를 검증하고 허용 범위를 넘으면 오류 메시지를 반환한다. */
export function parseMapBoundsQuery(
  searchParams: URLSearchParams,
): MapBoundsQueryResult {
  // 1. 네 방향 좌표가 모두 유효한 숫자인지 확인한다.
  // 일부 값만 있는 요청이 전체 스냅샷 조회로 이어지는 것을 방지한다.
  const north = parseCoordinate(searchParams.get("north"));
  const east = parseCoordinate(searchParams.get("east"));
  const south = parseCoordinate(searchParams.get("south"));
  const west = parseCoordinate(searchParams.get("west"));

  // 2. 좌표 범위와 방향 관계를 함께 검증한다.
  // 뒤집힌 경계나 지구 좌표 범위를 벗어난 값으로 예상하지 못한 데이터가 응답되는 것을 막는다.
  if (
    north === null ||
    east === null ||
    south === null ||
    west === null ||
    north <= south ||
    east <= west ||
    north > 90 ||
    south < -90 ||
    east > 180 ||
    west < -180
  ) {
    return { ok: false, message: "유효한 지도 범위를 입력해 주세요." };
  }

  // 3. 클라이언트 조회 최소 확대 단계에서 나올 수 있는 화면 폭보다 넓은 요청은 거절한다.
  // 확대 단계 값은 요청자가 임의로 보낼 수 있으므로 실제 경계의 폭으로 검사해 스냅샷 대량 수집을 막는다.
  const maxSpan =
    MAP_DATA_QUERY_MAX_SPAN_DEGREES + BOUNDS_NORMALIZATION_TOLERANCE_DEGREES;

  if (north - south > maxSpan || east - west > maxSpan) {
    return {
      ok: false,
      message: "잘못된 요청입니다.",
    };
  }

  return { ok: true, bounds: { north, east, south, west } };
}
