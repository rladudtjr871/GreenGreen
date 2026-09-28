export const SIGNAL_STALE_AFTER_MS = 30_000;
/** 데이터가 stale 되기 전에 한 번 동기화를 시작할 수 있도록 확보하는 여유 시간이다. */
export const SIGNAL_STALE_REFRESH_LEAD_MS = 5_000;
/** 현장 신호와 API 사이에서 확인된 지연을 보수적으로 보정하는 초 단위 여유값이다. */
export const SIGNAL_REMAINING_SAFETY_OFFSET_SECONDS = 3;
/** 화면에 0초를 표시한 뒤 최초 재조회까지 기다리는 시간이다. */
export const SIGNAL_ZERO_INITIAL_REFRESH_DELAY_MS = 1_000;
/** 보정된 잔여시간이 1초 미만으로 유지될 때 다음 신호를 확인하는 간격이다. */
export const SIGNAL_ZERO_RETRY_DELAY_MS = 2_000;
/** 사용자가 새로고침 버튼으로 연속 요청할 수 없도록 제한하는 간격이다. */
export const SIGNAL_MANUAL_REFRESH_COOLDOWN_MS = 5_000;
