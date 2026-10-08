"use client";

import Link from "next/link";

import styles from "./FaqMenu.module.css";
import { useFaqMenu } from "./useFaqMenu";

export function FaqMenu() {
  const { isOpen, menuRef, toggleMenu } = useFaqMenu();

  return (
    <div className={styles.menu} ref={menuRef}>
      {isOpen && (
        <nav className={styles.actions} aria-label="FAQ 메뉴">
          <Link className={styles.actionLink} href="/contact">
            <span className={styles.actionIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 5.5h14v10H9l-4 3v-13Z" />
                <path d="M8 9h8M8 12h5" />
              </svg>
            </span>
            문의
          </Link>
          <Link className={styles.actionLink} href="/guide">
            <span className={styles.actionIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 4.5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3v-12Z" />
                <path d="M8 8h6M8 11h6M8 14h4" />
              </svg>
            </span>
            가이드
          </Link>
        </nav>
      )}

      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""}`}
        aria-label={isOpen ? "FAQ 메뉴 닫기" : "FAQ 메뉴 열기"}
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.7 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1.9-1.1 1.8" />
          <path d="M12 16.5h.01" />
        </svg>
      </button>
    </div>
  );
}
