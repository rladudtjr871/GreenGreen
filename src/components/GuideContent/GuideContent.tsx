"use client";

import Image from "next/image";

import styles from "./GuideContent.module.css";
import { GUIDE_ITEMS, useGuideContent } from "./useGuideContent";

export function GuideContent() {
  const {
    activeGuide,
    activeTab,
    handleClose,
    handleTabChange,
    handleTabKeyDown,
    registerTab,
  } = useGuideContent();

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="guide-title">
        <header className={styles.header}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="사용 가이드 닫기"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <div>
            <span>HOW TO USE</span>
            <h1 id="guide-title">GreenGreen 사용 가이드</h1>
          </div>
          <span className={styles.headerSpacer} aria-hidden="true" />
        </header>

        <p className={styles.lead}>
          필요한 시설 탭을 선택하고 지도를 확대하면 주변 정보를 빠르게 확인할 수 있어요.
        </p>

        <div className={styles.tabs} role="tablist" aria-label="기능별 사용 가이드">
          {GUIDE_ITEMS.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => registerTab(index, element)}
              type="button"
              className={`${styles.tab} ${
                activeTab === item.id ? styles.tabActive : ""
              }`}
              role="tab"
              id={`guide-tab-${item.id}`}
              aria-selected={activeTab === item.id}
              aria-controls={`guide-panel-${item.id}`}
              tabIndex={activeTab === item.id ? 0 : -1}
              onClick={() => handleTabChange(item.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span className={styles.tabIcon} aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>

        <article
          className={styles.content}
          role="tabpanel"
          id={`guide-panel-${activeGuide.id}`}
          aria-labelledby={`guide-tab-${activeGuide.id}`}
        >
          <div className={styles.copy}>
            <span className={styles.eyebrow}>{activeGuide.eyebrow}</span>
            <h2>{activeGuide.title}</h2>
            <p className={styles.description}>{activeGuide.description}</p>

            <ol className={styles.steps}>
              {activeGuide.steps.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>

            <p className={styles.tip}>
              <strong>알아두세요</strong>
              {activeGuide.tip}
            </p>
          </div>

          <figure className={styles.preview}>
            <div className={styles.imageFrame}>
              <Image
                src="/images/guide/greengreen-map.png"
                alt="GreenGreen 지도에서 신호등, 휴지통, 화장실 탭을 선택하는 화면"
                fill
                sizes="(max-width: 760px) 100vw, 48vw"
                priority
              />
              <span className={styles.imageBadge}>{activeGuide.imageLabel}</span>
            </div>
            <figcaption>
              지도 상단의 탭을 바꾸면 선택한 정보만 지도에 표시됩니다.
            </figcaption>
          </figure>
        </article>
      </section>
    </main>
  );
}
