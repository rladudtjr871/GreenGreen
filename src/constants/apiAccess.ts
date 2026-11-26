/** 익명 접근 토큰을 저장하는 httpOnly 쿠키 이름이다. */
export const API_ACCESS_TOKEN_COOKIE_NAME = "gg_access";
/** 익명 접근 토큰의 유효 시간(초)이다. */
export const API_ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60;
/** 페이지 요청 시 남은 유효 시간이 이보다 짧으면 토큰을 새로 발급하는 기준(초)이다. */
export const API_ACCESS_TOKEN_REFRESH_THRESHOLD_SECONDS = 60 * 60;

/** 신호 API 호출 횟수를 세는 구간 길이(ms)다. */
export const SIGNAL_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1_000;
/** 토큰 하나가 구간 안에서 신호 API를 호출할 수 있는 최대 횟수다. */
export const SIGNAL_RATE_LIMIT_MAX_REQUESTS = 20;

/** 토큰, 출처 검사에 실패한 요청에 반환하는 사용자용 메시지다. */
export const API_INVALID_REQUEST_MESSAGE = "잘못된 요청입니다.";
/** 토큰이 없거나 만료된 요청에 반환하는 사용자용 메시지다. */
export const API_TOKEN_EXPIRED_MESSAGE =
  "페이지를 새로고침한 뒤 다시 시도해 주세요.";
/** 호출 횟수 제한을 넘은 요청에 반환하는 사용자용 메시지다. */
export const API_RATE_LIMITED_MESSAGE =
  "요청 가능 횟수를 초과하였습니다.\n잠시 후 다시 시도해 주세요.";
