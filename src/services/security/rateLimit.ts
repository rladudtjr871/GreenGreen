/** 키별로 구간 안에 허용된 요청 시각 목록이다. */
const requestTimesByKey = new Map<string, number[]>();

/** 오래된 키를 정리하는 최소 간격(ms)이다. */
const CLEANUP_INTERVAL_MS = 60 * 1_000;

let lastCleanupAt = 0;

/** 구간이 지난 기록만 남은 키를 지워 메모리가 계속 늘어나지 않게 한다. */
function cleanupExpiredKeys(now: number, windowMs: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAt = now;
  requestTimesByKey.forEach((times, key) => {
    if (times.every((time) => now - time >= windowMs)) {
      requestTimesByKey.delete(key);
    }
  });
}

/** 키의 최근 요청 수가 한도 안이면 기록하고 true, 넘으면 false를 반환한다. */
export function consumeRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  cleanupExpiredKeys(now, windowMs);

  // 1. 구간 안의 요청 시각만 남긴다.
  // 고정 구간 대신 최근 windowMs 동안의 요청 수를 세어 구간 경계에서 한도가 두 배가 되는 것을 막는다.
  const recentTimes = (requestTimesByKey.get(key) ?? []).filter(
    (time) => now - time < windowMs,
  );

  // 2. 한도를 넘으면 기록하지 않고 거절한다.
  // 거절된 요청까지 세면 한도 초과 상태에서 재시도할수록 대기 시간이 계속 늘어나기 때문이다.
  if (recentTimes.length >= maxRequests) {
    requestTimesByKey.set(key, recentTimes);
    return false;
  }

  recentTimes.push(now);
  requestTimesByKey.set(key, recentTimes);
  return true;
}
