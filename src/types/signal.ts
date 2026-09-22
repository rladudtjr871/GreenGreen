/** 교차로 중심을 기준으로 보행신호가 향하는 방위다. */
/** T-Data가 차량의 교차로 진입 방위를 기준으로 부여한 신호 그룹 방향이다. */
export type SignalDirection =
  | "north"
  | "northEast"
  | "east"
  | "southEast"
  | "south"
  | "southWest"
  | "west"
  | "northWest";

/**
 * 화면에서 사용하는 보행신호 상태다.
 * `clearance`는 점멸 등 종료 임박 상태이고, `unknown`은 없거나 신뢰할 수 없는 정보다.
 */
export type PedestrianSignalState =
  | "walk"
  | "clearance"
  | "stop"
  | "unknown";

export type PedestrianSignalDirection = {
  /** 횡단 방향이 아닌 T-Data 차량 진입 기준의 신호 그룹 방위다. */
  direction: SignalDirection;
  /** 신호 그룹과 연결된 횡단보도의 교차로 기준 위치 이름이다. */
  label: string;
  /** 외부 상태명을 내부 표시 규칙으로 변환한 현재 보행신호 상태다. */
  state: PedestrianSignalState;
  /** 현재 상태가 끝날 때까지 남은 초이며, 미제공 또는 규격의 invalid 값이면 `null`이다. */
  remainingSeconds: number | null;
};

export type PedestrianSignal = {
  /** 신호정보가 속한 T-Data 교차로 식별자다. */
  intersectionId: string;
  /** 신호 장비가 데이터를 관측한 ISO 8601 시각이다. */
  observedAt: string;
  /** GreenGreen 서버가 외부 응답을 수신한 ISO 8601 시각이다. */
  receivedAt: string;
  /** 관측 시각이 없거나 허용된 최신성 기준을 벗어났는지 나타낸다. */
  isStale: boolean;
  /** 해당 교차로에서 제공되는 방향별 보행신호 목록이다. */
  directions: PedestrianSignalDirection[];
};
