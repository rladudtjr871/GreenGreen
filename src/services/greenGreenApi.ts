import type { Intersection } from "@/types/intersection";
import type { MapBounds } from "@/types/map";
import type { TrashBin, TrashBinDataVersion } from "@/types/trashBin";
import type { Restroom } from "@/types/restroom";
import type {
  PedestrianSignal,
  PedestrianSignalDirection,
} from "@/types/signal";
import type { ContactRequest } from "@/types/contact";

/** 값이 배열이 아닌 일반 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 값이 문자열 또는 null인지 확인한다. */
function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

/** 응답 값이 교차로 모델 형태인지 확인한다. */
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

/** 응답 값이 휴지통 모델 형태인지 확인한다. */
function isTrashBin(value: unknown): value is TrashBin {
  if (!isRecord(value) || !isRecord(value.coordinate)) {
    return false;
  }

  return (
    typeof value.trashBinId === "string" &&
    typeof value.name === "string" &&
    typeof value.city === "string" &&
    typeof value.district === "string" &&
    typeof value.address === "string" &&
    typeof value.detail === "string" &&
    typeof value.trashBinType === "string" &&
    typeof value.managingOrganization === "string" &&
    typeof value.coordinate.latitude === "number" &&
    typeof value.coordinate.longitude === "number"
  );
}

/** 응답 값이 화장실 모델 형태인지 확인한다. */
function isRestroom(value: unknown): value is Restroom {
  if (!isRecord(value) || !isRecord(value.coordinate)) {
    return false;
  }

  return (
    typeof value.restroomId === "string" &&
    typeof value.name === "string" &&
    isNullableString(value.district) &&
    isNullableString(value.roadAddress) &&
    isNullableString(value.lotAddress) &&
    isNullableString(value.restroomType) &&
    isNullableString(value.openingHours) &&
    isNullableString(value.availability) &&
    isNullableString(value.accessibleAvailability) &&
    isNullableString(value.locationCategory) &&
    isNullableString(value.closedDays) &&
    isNullableString(value.facilities) &&
    isNullableString(value.safetyFacilities) &&
    isNullableString(value.telephone) &&
    isNullableString(value.note) &&
    typeof value.coordinate.latitude === "number" &&
    typeof value.coordinate.longitude === "number"
  );
}

/** 응답 값이 방향별 보행 신호 형태인지 확인한다. */
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

/** 응답 값이 교차로 보행 신호 모델 형태인지 확인한다. */
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

/** JSON 응답을 해석하고 실패 응답은 서버 메시지로 오류를 던진다. */
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

/** 지도 경계 안의 교차로 목록을 내부 API에서 조회한다. */
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

/** 지도 경계 안의 휴지통 목록을 데이터 버전별로 내부 API에서 조회한다. */
export async function fetchTrashBins(
  bounds: MapBounds,
  version: TrashBinDataVersion,
): Promise<TrashBin[]> {
  // 1. 현재 지도 경계를 Route Handler 쿼리로 변환한다.
  // 서버가 전국 스냅샷을 필터링하므로 브라우저에는 화면 안의 행만 전달된다.
  const searchParams = new URLSearchParams({
    north: String(bounds.north),
    east: String(bounds.east),
    south: String(bounds.south),
    west: String(bounds.west),
    version,
  });

  // 2. 응답 구조를 런타임에서도 검증해 손상된 마커 데이터가 지도에 전달되지 않게 한다.
  const response = await fetch(`/api/trash-bins?${searchParams.toString()}`);
  const payload = await parseApiResponse(response);

  if (!Array.isArray(payload) || !payload.every(isTrashBin)) {
    throw new Error("휴지통 응답 형식이 올바르지 않습니다.");
  }

  return payload;
}

/** 지도 경계 안의 화장실 목록을 내부 API에서 조회한다. */
export async function fetchRestrooms(
  bounds: MapBounds,
): Promise<Restroom[]> {
  // 1. 현재 지도 경계를 Route Handler 쿼리로 변환한다.
  // 서버에서 화면 안의 행만 선별해 브라우저의 데이터 처리량을 제한한다.
  const searchParams = new URLSearchParams({
    north: String(bounds.north),
    east: String(bounds.east),
    south: String(bounds.south),
    west: String(bounds.west),
  });

  // 2. 응답 구조를 런타임에서도 검증한다.
  // 정적 데이터 형식이 변경되어도 잘못된 마커가 만들어지기 전에 오류로 처리한다.
  const response = await fetch(`/api/restrooms?${searchParams.toString()}`);
  const payload = await parseApiResponse(response);

  if (!Array.isArray(payload) || !payload.every(isRestroom)) {
    throw new Error("화장실 응답 형식이 올바르지 않습니다.");
  }

  return payload;
}

/** 선택한 교차로의 실시간 보행 신호를 캐시 없이 조회한다. */
export async function fetchPedestrianSignal(
  intersectionId: string,
): Promise<PedestrianSignal> {
  // 1. 요청을 보내기 직전의 브라우저 시각을 카운트다운 기준으로 기록한다.
  // 서버 시계로 찍힌 receivedAt을 기기 시계와 비교하면 두 시계 차이만큼 카운트다운이 멈추거나 건너뛴다.
  // 응답 도착 시각보다 이른 요청 시각을 쓰면 왕복 지연만큼 잔여시간이 짧게 계산되어 실제보다 길게 안내하지 않는다.
  const requestedAt = new Date().toISOString();

  // 2. 교차로 ID를 URL 인코딩하고 실시간 응답이 브라우저 캐시에 남지 않게 요청한다.
  const response = await fetch(
    `/api/signals/${encodeURIComponent(intersectionId)}`,
    { cache: "no-store" },
  );
  // 3. 안전 표시와 카운트다운에 필요한 필드가 모두 있는지 확인한다.
  const payload = await parseApiResponse(response);

  if (!isPedestrianSignal(payload)) {
    throw new Error("신호정보 응답 형식이 올바르지 않습니다.");
  }

  // 4. 화면의 카운트다운과 stale 판단이 모두 같은 기기 시계를 기준으로 동작하도록 수신 시각을 바꾼다.
  return { ...payload, receivedAt: requestedAt };
}

/** 문의 내용을 내부 문의 API로 전송하고 결과 메시지를 반환한다. */
export async function sendContactInquiry(
  contactRequest: ContactRequest,
): Promise<string> {
  // 1. 문의 내용은 외부 서비스가 아닌 프로젝트 Route Handler로만 전달한다.
  // 서버가 입력을 다시 검증하고 EmailJS Public Key를 노출하지 않은 채 전송하기 위함이다.
  const response = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contactRequest),
  });

  // 2. 공통 응답 처리로 서버가 반환한 성공 또는 실패 메시지를 일관되게 사용한다.
  const payload = await parseApiResponse(response);

  if (!isRecord(payload) || typeof payload.message !== "string") {
    throw new Error("문의 전송 결과를 확인할 수 없습니다.");
  }

  return payload.message;
}
