import type { Intersection } from "@/types/intersection";
import type { PedestrianSignal } from "@/types/signal";

import styles from "./SignalCard.module.css";
import { useSignalCard } from "./useSignalCard";

type SignalCardProps = {
  /** 상세 카드의 제목과 식별에 사용하는 선택된 교차로다. */
  intersection: Intersection;
  /** 조회된 보행신호이며 최초 응답 전에는 `undefined`다. */
  signal: PedestrianSignal | undefined;
  /** 최초 신호 요청이 진행 중인지 나타낸다. */
  isLoading: boolean;
  /** 기존 데이터를 유지한 채 다음 신호를 동기화 중인지 나타낸다. */
  isRefreshing: boolean;
  /** 신호 요청 실패 시 표시할 사용자용 메시지이며 오류가 없으면 빈 문자열이다. */
  errorMessage: string;
  /** 사용자가 상세 카드를 닫을 때 선택 상태를 해제하는 콜백이다. */
  onClose: () => void;
  /** 표시 중인 유효한 잔여시간이 0초가 되었을 때 최신 신호를 다시 요청하는 콜백이다. */
  onRemainingTimeEnd: () => void;
};

export function SignalCard({
  intersection,
  signal,
  isLoading,
  isRefreshing,
  errorMessage,
  onClose,
  onRemainingTimeEnd,
}: SignalCardProps) {
  const { directions, isStale, updatedTime } = useSignalCard(
    signal,
    onRemainingTimeEnd,
  );

  return (
    <aside className={styles.card} aria-label={`${intersection.name} 신호정보`}>
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>실시간 보행신호</span>
          <h2>{intersection.name}</h2>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="신호정보 닫기"
        >
          ×
        </button>
      </div>

      {isLoading && (
        <p className={styles.stateMessage} role="status">
          신호정보를 불러오고 있습니다.
        </p>
      )}

      {!isLoading && errorMessage && (
        <p className={styles.errorMessage} role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading && !errorMessage && signal && (
        <>
          {isStale && (
            <p className={styles.staleMessage} role="status">
              신호정보 갱신이 지연되고 있습니다.
            </p>
          )}

          {directions.length > 0 ? (
            <ul className={styles.signalList}>
              {directions.map((direction) => (
                <li
                  key={direction.direction}
                  className={`${styles.signalItem} ${
                    direction.state === "walk" ? styles.walkSignalItem : ""
                  }`}
                >
                  <span
                    className={`${styles.signalLight} ${styles[direction.state]}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`${styles.directionLabel} ${
                      direction.state === "walk" ? styles.walkDirection : ""
                    }`}
                  >
                    {direction.label}
                  </span>
                  <span className={styles.remainingTime}>
                    {direction.remainingLabel}
                  </span>
                  <strong>{direction.stateLabel}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.stateMessage}>
              제공되는 보행신호 방향이 없습니다.
            </p>
          )}

          <p className={styles.updatedAt}>
            {isRefreshing ? "신호 동기화 중 · " : ""}
            {updatedTime} 기준
          </p>
        </>
      )}

      <div className={styles.safetyNotice}>
        <p>
          제공되는 신호정보는 통신상태에 따라 실제 신호와 차이가 발생할 수
          있습니다.
        </p>
        <p>횡단 시 반드시 실제 신호등을 확인하세요.</p>
      </div>
    </aside>
  );
}
