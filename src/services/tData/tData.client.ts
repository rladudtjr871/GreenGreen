const TDATA_API_BASE_URL =
  "https://t-data.seoul.go.kr/apig/apiman-gateway/tapi";
const TDATA_REQUEST_TIMEOUT_MS = 8_000;

type TDataApiKeyParameter = "apiKey" | "apikey";

export class TDataApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "TDataApiError";
  }
}

function getTDataApiKey(): string {
  // 비밀 키는 서버 환경에서만 읽고, 누락 시 외부 요청 전에 명확히 실패시킨다.
  const apiKey = process.env.TDATA_API_KEY?.trim();

  if (!apiKey) {
    throw new TDataApiError("TDATA_API_KEY가 설정되지 않았습니다.", 500);
  }

  return apiKey;
}

export async function fetchTDataRecords(
  endpoint: string,
  apiKeyParameter: TDataApiKeyParameter,
  parameters: Record<string, string>,
  revalidateSeconds: number,
): Promise<Record<string, unknown>[]> {
  // 1. 엔드포인트별 표기가 다른 API Key 이름과 요청 파라미터를 URL에 조립한다.
  // 모든 T-Data 호출이 같은 인증 및 인코딩 경로를 사용하게 하기 위함이다.
  const url = new URL(`${TDATA_API_BASE_URL}/${endpoint}`);
  url.searchParams.set(apiKeyParameter, getTDataApiKey());

  Object.entries(parameters).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  let response: Response;

  // 2. 제한 시간과 캐시 정책을 적용해 외부 API를 호출한다.
  // 응답 지연이 Route Handler를 무기한 점유하지 않도록 타임아웃을 둔다.
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(TDATA_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new TDataApiError("T-Data API에 연결할 수 없습니다.", 503);
  }

  // 3. 호출 한도 오류는 사용자가 다시 시도할 수 있도록 별도로 구분한다.
  // 그 외 외부 서버 오류는 내부 구현을 노출하지 않는 공통 메시지로 바꾼다.
  if (!response.ok) {
    const status = response.status === 429 ? 429 : 502;
    const message =
      response.status === 429
        ? "T-Data API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요."
        : "T-Data API가 정상적으로 응답하지 않았습니다.";

    throw new TDataApiError(message, status);
  }

  let payload: unknown;

  // 4. JSON을 해석한 뒤 객체 레코드만 통과시킨다.
  // 외부 응답을 신뢰하지 않고 mapper가 처리할 수 있는 최소 형태를 보장한다.
  try {
    payload = await response.json();
  } catch {
    throw new TDataApiError("T-Data API 응답을 해석할 수 없습니다.", 502);
  }

  if (!Array.isArray(payload)) {
    throw new TDataApiError("T-Data API 응답 형식이 올바르지 않습니다.", 502);
  }

  return payload.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}
