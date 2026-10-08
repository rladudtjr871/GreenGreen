"use client";

import styles from "./ContactForm.module.css";
import { useContactForm } from "./useContactForm";

export function ContactForm() {
  const {
    title,
    content,
    handleClose,
    handleTitleChange,
    handleContentChange,
  } = useContactForm();

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="contact-title">
        <header className={styles.header}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="문의 작성 닫기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <div className={styles.heading}>
            <span>CONTACT</span>
            <h1 id="contact-title">문의하기</h1>
          </div>
          <button type="button" className={styles.submitButton}>
            등록
          </button>
        </header>

        <div className={styles.intro}>
          <p>GreenGreen을 사용하며 발견한 문제나 의견을 남겨주세요.</p>
          <span>현재는 문의 화면을 준비 중이며 등록 내용은 전송되지 않습니다.</span>
        </div>

        <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
          <label className={styles.field}>
            <span className={styles.label}>제목</span>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="문의 제목을 입력해 주세요"
              autoComplete="off"
            />
          </label>

          <label className={`${styles.field} ${styles.contentField}`}>
            <span className={styles.label}>내용</span>
            <textarea
              value={content}
              onChange={handleContentChange}
              placeholder="문의 내용을 자세히 입력해 주세요"
            />
          </label>
        </form>

        <p className={styles.notice}>
          메일 발송 방식이 확정되면 등록 기능을 연결할 예정입니다.
        </p>
      </section>
    </main>
  );
}
