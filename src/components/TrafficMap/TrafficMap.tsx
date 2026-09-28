"use client";

import styles from "./TrafficMap.module.css";
import { useTrafficMap } from "./useTrafficMap";
import { SignalCard } from "@/components/SignalCard/SignalCard";
import { RestroomCard } from "@/components/RestroomCard/RestroomCard";

export function TrafficMap() {
  const {
    mapContainerRef,
    mapStatus,
    mapErrorMessage,
    locationStatus,
    locationMessage,
    isCurrentLocationActive,
    isCurrentLocationDisabled,
    handleCurrentLocation,
    activeLayer,
    handleLayerChange,
    guide,
    serviceBadgeText,
    selectedIntersection,
    selectedRestroom,
    signal,
    isSignalLoading,
    isSignalRefreshing,
    signalErrorMessage,
    handleRefreshSignal,
    handleCloseSignal,
    handleCloseRestroom,
  } = useTrafficMap();

  return (
    <main className={styles.page}>
      <section className={styles.mapShell} aria-label="GreenGreen 생활 지도">
        <div className={styles.map}>
          <div ref={mapContainerRef} className={styles.mapCanvas} />
        </div>

        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true">
              <svg
                className={styles.trafficLightIcon}
                viewBox="0 0 44 44"
              >
                <circle
                  className={styles.redLight}
                  cx="10.5"
                  cy="22"
                  r="4.5"
                />
                <circle
                  className={styles.yellowLight}
                  cx="22"
                  cy="22"
                  r="4.5"
                />
                <circle
                  className={styles.greenLight}
                  cx="33.5"
                  cy="22"
                  r="4.5"
                />
              </svg>
            </span>
            <div>
              <p className={styles.brandName}>GreenGreen</p>
              <p className={styles.brandDescription}>보행자 신호 · 휴지통 지도</p>
            </div>
          </div>

          <span className={styles.serviceBadge}>{serviceBadgeText}</span>

          <nav className={styles.layerTabs} aria-label="지도 정보 선택" role="tablist">
            <button
              type="button"
              className={`${styles.layerTab} ${
                activeLayer === "signals" ? styles.layerTabActive : ""
              }`}
              role="tab"
              aria-selected={activeLayer === "signals"}
              onClick={() => handleLayerChange("signals")}
            >
              신호등
            </button>
            <button
              type="button"
              className={`${styles.layerTab} ${
                activeLayer === "trashBins" ? styles.layerTabActive : ""
              }`}
              role="tab"
              aria-selected={activeLayer === "trashBins"}
              onClick={() => handleLayerChange("trashBins")}
            >
              휴지통
            </button>
            <button
              type="button"
              className={`${styles.layerTab} ${
                activeLayer === "restrooms" ? styles.layerTabActive : ""
              }`}
              role="tab"
              aria-selected={activeLayer === "restrooms"}
              onClick={() => handleLayerChange("restrooms")}
            >
              화장실
            </button>
          </nav>
        </header>

        {mapStatus === "loading" && (
          <div className={styles.mapMessage} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <strong>지도를 준비하고 있어요</strong>
            <span>잠시만 기다려 주세요.</span>
          </div>
        )}

        {mapStatus === "error" && (
          <div className={styles.mapMessage} role="alert">
            <span className={styles.errorIcon} aria-hidden="true">
              !
            </span>
            <strong>지도를 표시할 수 없어요</strong>
            <span>{mapErrorMessage}</span>
          </div>
        )}

        {selectedIntersection ? (
          <SignalCard
            intersection={selectedIntersection}
            signal={signal}
            isLoading={isSignalLoading}
            isRefreshing={isSignalRefreshing}
            errorMessage={signalErrorMessage}
            onRefresh={handleRefreshSignal}
            onAutoRefresh={handleRefreshSignal}
            onClose={handleCloseSignal}
          />
        ) : selectedRestroom ? (
          <RestroomCard
            restroom={selectedRestroom}
            onClose={handleCloseRestroom}
          />
        ) : (
          <div className={styles.mapControls}>
            <aside className={styles.guideCard}>
              <span className={styles.guideEyebrow}>{guide.eyebrow}</span>
              <h1>{guide.title}</h1>
              <p>{guide.description}</p>
            </aside>

            <div className={styles.locationPanel}>
              <div className={styles.locationControl}>
                {locationStatus === "error" && (
                  <p
                    className={`${styles.locationMessage} ${
                      locationStatus === "error" ? styles.locationError : ""
                    }`}
                    role="status"
                  >
                    {locationMessage}
                  </p>
                )}
                <button
                  type="button"
                  className={`${styles.locationButton} ${
                    isCurrentLocationActive ? styles.locationButtonActive : ""
                  }`}
                  onClick={handleCurrentLocation}
                  disabled={isCurrentLocationDisabled}
                  aria-label="현재 위치로 이동"
                >
                  {locationStatus === "locating" ? (
                    <span
                      className={styles.buttonSpinner}
                      aria-hidden="true"
                    />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className={styles.locationIcon}
                    >
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  )}
                </button>
              </div>

              <p className={styles.locationHint}>
                {locationStatus === "locating" ? "이동 중" : "현재 위치"}
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
