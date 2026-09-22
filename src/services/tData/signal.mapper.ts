import type {
  PedestrianSignal,
  PedestrianSignalState,
  SignalDirection,
} from "@/types/signal";
import { SIGNAL_STALE_AFTER_MS } from "@/constants/signal";

const DIRECTION_FIELDS: Array<{
  direction: SignalDirection;
  label: string;
  prefix: string;
}> = [
  // T-Data 방향은 차량 진입 방향이므로 우측에 연결된 횡단보도 위치로 변환한다.
  { direction: "north", label: "서측 횡단보도", prefix: "nt" },
  { direction: "northEast", label: "북서측 횡단보도", prefix: "ne" },
  { direction: "east", label: "북측 횡단보도", prefix: "et" },
  { direction: "southEast", label: "북동측 횡단보도", prefix: "se" },
  { direction: "south", label: "동측 횡단보도", prefix: "st" },
  { direction: "southWest", label: "남동측 횡단보도", prefix: "sw" },
  { direction: "west", label: "남측 횡단보도", prefix: "wt" },
  { direction: "northWest", label: "남서측 횡단보도", prefix: "nw" },
];

const MAX_VALID_REMAINING_DECISECONDS = 36_000;

function parseState(value: unknown): PedestrianSignalState {
  if (typeof value !== "string") {
    return "unknown";
  }

  const normalized = value.toLowerCase();

  // 외부 상태명을 안전 우선순위(정지 → 종료 임박 → 보행 가능)로 내부 상태에 대응시킨다.
  // 알 수 없는 새 상태명은 보행 가능으로 추정하지 않고 unknown으로 남긴다.
  if (normalized === "stop-and-remain") {
    return "stop";
  }

  if (normalized.includes("clearance") || normalized.includes("caution")) {
    return "clearance";
  }

  if (normalized.includes("allowed")) {
    return "walk";
  }

  return "unknown";
}

function parseRemainingSeconds(value: unknown): number | null {
  const deciseconds = typeof value === "number" ? value : Number(value);

  // 1. 숫자가 아니거나 J2735 TimeMark 유효 범위를 벗어난 값은 표시하지 않는다.
  // 특히 36001은 잔여시간이 아니라 invalid를 뜻해 60분 1초로 변환하면 안 된다.
  if (
    !Number.isFinite(deciseconds) ||
    deciseconds < 0 ||
    deciseconds > MAX_VALID_REMAINING_DECISECONDS
  ) {
    return null;
  }

  // 2. 유효한 T-Data의 0.1초 단위를 초로 올림한다.
  // 소수 단위를 버려 실제보다 시간이 짧게 표시되는 일을 방지한다.
  return Math.ceil(deciseconds / 10);
}

function parseObservedAt(record: Record<string, unknown>): string | null {
  // 1. 장비 전송 UTC 시간을 우선 사용한다.
  // 데이터 생성 시각에 가장 가까워 stale 판단의 기준으로 적합하기 때문이다.
  const utcValue = record.trsmUtcTime;
  const numericUtc = typeof utcValue === "number" ? utcValue : Number(utcValue);

  if (Number.isFinite(numericUtc) && numericUtc > 0) {
    const milliseconds = numericUtc < 10_000_000_000 ? numericUtc * 1_000 : numericUtc;
    const date = new Date(milliseconds);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // 2. 장비 시간이 없거나 유효하지 않을 때 등록 시각을 보조 값으로 사용한다.
  // 둘 다 해석할 수 없으면 수신 시각으로 위장하지 않고 null을 반환한다.
  if (typeof record.regDt === "string") {
    const date = new Date(record.regDt);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

export function mapTDataPedestrianSignal(
  record: Record<string, unknown>,
  fallbackIntersectionId: string,
): PedestrianSignal {
  // 1. 수신 시각과 실제 관측 시각을 분리한다.
  // 카운트다운은 최신 잔여값의 수신 시각, 데이터 신선도는 장비 관측 시각을 사용한다.
  const receivedAt = new Date().toISOString();
  const parsedObservedAt = parseObservedAt(record);
  const observedAt = parsedObservedAt ?? receivedAt;
  const observedTime = new Date(observedAt).getTime();
  const age = Date.now() - observedTime;

  // 2. 여덟 방향의 동적 필드명을 내부 방향 모델로 변환한다.
  // 원본 상태 필드가 없는 방향은 제공되지 않은 것으로 보고 결과에서 제외한다.
  const directions = DIRECTION_FIELDS.map(({ direction, label, prefix }) => {
    const rawState = record[`${prefix}PdsgStatNm`];
    const rawRemaining = record[`${prefix}PdsgRmdrCs`];

    return {
      direction,
      label,
      state: parseState(rawState),
      remainingSeconds: parseRemainingSeconds(rawRemaining),
      hasData: rawState !== null && rawState !== undefined,
    };
  })
    .filter(({ hasData }) => hasData)
    .map(({ direction, label, state, remainingSeconds }) => ({
      direction,
      label,
      state,
      remainingSeconds,
    }));

  // 3. 관측 시각이 없거나 허용 범위를 벗어나면 stale로 표시한다.
  // 미래 시각도 장비 시계 오류일 수 있으므로 현재 신호로 신뢰하지 않는다.
  return {
    intersectionId: String(record.itstId ?? fallbackIntersectionId),
    observedAt,
    receivedAt,
    isStale:
      parsedObservedAt === null || age > SIGNAL_STALE_AFTER_MS || age < -5_000,
    directions,
  };
}
