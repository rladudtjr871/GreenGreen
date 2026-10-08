"use client";

import styles from "./ContactForm.module.css";
import { useContactForm } from "./useContactForm";

export function ContactForm() {
  const {
    title,
    content,
    fieldErrors,
    submitMessage,
    submitStatus,
    isSubmitting,
    handleClose,
    handleTitleChange,
    handleContentChange,
    handleSubmit,
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
          <button
            type="submit"
            form="contact-form"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? "전송 중" : "보내기"}
          </button>
        </header>

        <div className={styles.intro}>
          <p>GreenGreen을 사용하며 발견한 문제나 의견을 남겨주세요.</p>
          <span>보내주신 내용은 서비스 개선을 위해 확인합니다.</span>
        </div>

        <form
          id="contact-form"
          className={styles.form}
          onSubmit={handleSubmit}
          noValidate
        >
          <label className={styles.field}>
            <span className={styles.label}>제목</span>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="문의 제목을 입력해 주세요"
              autoComplete="off"
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? "contact-title-error" : undefined}
            />
            {fieldErrors.title && (
              <span id="contact-title-error" className={styles.fieldError}>
                {fieldErrors.title}
              </span>
            )}
          </label>

          <label className={`${styles.field} ${styles.contentField}`}>
            <span className={styles.label}>내용</span>
            <textarea
              value={content}
              onChange={handleContentChange}
              placeholder="문의 내용을 자세히 입력해 주세요"
              maxLength={2000}
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={
                fieldErrors.message ? "contact-message-error" : undefined
              }
            />
            {fieldErrors.message && (
              <span id="contact-message-error" className={styles.fieldError}>
                {fieldErrors.message}
              </span>
            )}
          </label>
        </form>

        <p
          className={`${styles.notice} ${
            submitStatus === "success"
              ? styles.noticeSuccess
              : submitStatus === "error"
                ? styles.noticeError
                : ""
          }`}
          role={submitStatus === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {submitMessage ||
            "보내주신 문의는 확인 후 서비스 개선에 반영하며 별도 답변은 제공되지 않습니다."}
        </p>
      </section>
    </main>
  );
}
