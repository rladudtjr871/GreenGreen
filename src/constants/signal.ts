export const SIGNAL_STALE_AFTER_MS = 30_000;
/** 현장 신호와 API 사이에서 확인된 지연을 보수적으로 보정하는 초 단위 여유값이다. */
export const SIGNAL_REMAINING_SAFETY_OFFSET_SECONDS = 3;
/** 보정된 잔여시간이 1초 미만으로 유지될 때 다음 신호를 확인하는 간격이다. */
export const SIGNAL_ZERO_RETRY_DELAY_MS = 2_000;
/** 사용자가 새로고침 버튼으로 연속 요청할 수 없도록 제한하는 간격이다. */
export const SIGNAL_MANUAL_REFRESH_COOLDOWN_MS = 5_000;
