import type { Intersection } from "@/types/intersection";
import type { MapBounds } from "@/types/map";
import type {
  PedestrianSignal,
  PedestrianSignalDirection,
} from "@/types/signal";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntersection(value: unknown): value is Intersection {
  if (!isRecord(value) || !isRecord(value.coordinate)) {
    return false;
  }

  return (
    typeof value.intersectionId === "string" &&
    typeof value.name === "string" &&
    typeof value.coordinate.latitude === "number" &&
    typeof value.coordinate.longitude === "number"
  );
}

function isSignalDirection(value: unknown): value is PedestrianSignalDirection {
  return (
    isRecord(value) &&
    typeof value.direction === "string" &&
    typeof value.label === "string" &&
    typeof value.state === "string" &&
    (typeof value.remainingSeconds === "number" ||
      value.remainingSeconds === null)
  );
}

function isPedestrianSignal(value: unknown): value is PedestrianSignal {
  return (
    isRecord(value) &&
    typeof value.intersectionId === "string" &&
    typeof value.observedAt === "string" &&
    typeof value.receivedAt === "string" &&
    typeof value.isStale === "boolean" &&
    Array.isArray(value.directions) &&
    value.directions.every(isSignalDirection)
  );
}

async function parseApiResponse(response: Response): Promise<unknown> {
  let payload: unknown;

  // 1. 성공 여부와 관계없이 JSON 본문을 먼저 해석한다.
  // 실패 응답에 포함된 서버 메시지도 동일한 경로로 사용자에게 전달하기 위함이다.
  try {
    payload = await response.json();
  } catch {
    throw new Error("서버 응답을 확인할 수 없습니다.");
  }

  // 2. HTTP 오류는 Route Handler가 제공한 안전한 메시지로 변환한다.
  if (!response.ok) {
    const message =
      isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : "요청을 처리하는 중 문제가 발생했습니다.";
    throw new Error(message);
  }

  return payload;
}

export async function fetchIntersections(
  bounds: MapBounds,
): Promise<Intersection[]> {
  // 1. 현재 지도 범위를 내부 Route Handler의 쿼리 문자열로 변환한다.
  const searchParams = new URLSearchParams({
    north: String(bounds.north),
    east: String(bounds.east),
    south: String(bounds.south),
    west: String(bounds.west),
  });
  // 2. 서버 응답을 받은 뒤 런타임 형태까지 검증한다.
  // TypeScript 타입만으로는 네트워크 응답을 보장할 수 없기 때문이다.
  const response = await fetch(`/api/intersections?${searchParams.toString()}`);
  const payload = await parseApiResponse(response);

  if (!Array.isArray(payload) || !payload.every(isIntersection)) {
    throw new Error("교차로 응답 형식이 올바르지 않습니다.");
  }

  return payload;
}

export async function fetchPedestrianSignal(
  intersectionId: string,
): Promise<PedestrianSignal> {
  // 1. 교차로 ID를 URL 인코딩하고 실시간 응답이 브라우저 캐시에 남지 않게 요청한다.
  const response = await fetch(
    `/api/signals/${encodeURIComponent(intersectionId)}`,
    { cache: "no-store" },
  );
  // 2. 안전 표시와 카운트다운에 필요한 필드가 모두 있는지 확인한다.
  const payload = await parseApiResponse(response);

  if (!isPedestrianSignal(payload)) {
    throw new Error("신호정보 응답 형식이 올바르지 않습니다.");
  }

  return payload;
}
