import type { Restroom } from "@/types/restroom";

import styles from "./RestroomCard.module.css";
import { useRestroomCard } from "./useRestroomCard";

type RestroomCardProps = {
  restroom: Restroom;
  onClose: () => void;
};

export function RestroomCard({ restroom, onClose }: RestroomCardProps) {
  const { address, details } = useRestroomCard(restroom);

  return (
    <aside className={styles.card} aria-label={`${restroom.name} 화장실 정보`}>
      <div className={styles.heading}>
        <div className={styles.titleGroup}>
          <span className={styles.eyebrow}>
            {restroom.restroomType || "공중화장실"}
          </span>
          <h2>{restroom.name}</h2>
          {address && <p className={styles.address}>{address}</p>}
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="화장실 정보 닫기"
        >
          ×
        </button>
      </div>

      {details.length > 0 && (
        <dl className={styles.detailList}>
          {details.map(({ label, value }) => (
            <div className={styles.detailItem} key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className={styles.notice}>
        운영 정보는 현장 사정에 따라 달라질 수 있습니다.
      </p>
    </aside>
  );
}
