"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  SIGNAL_MANUAL_REFRESH_COOLDOWN_MS,
  SIGNAL_STALE_AFTER_MS,
  SIGNAL_STALE_REFRESH_LEAD_MS,
  SIGNAL_ZERO_INITIAL_REFRESH_DELAY_MS,
  SIGNAL_ZERO_RETRY_DELAY_MS,
} from "@/constants/signal";
import type {
  PedestrianSignal,
  PedestrianSignalState,
} from "@/types/signal";

const STATE_LABELS: Record<PedestrianSignalState, string> = {
  walk: "보행 가능",
  clearance: "곧 종료",
  stop: "정지",
  unknown: "정보 없음",
};

function formatRemainingTime(totalSeconds: number): string {
  // 1. 전체 초를 분과 나머지 초로 나눈다.
  // API 값이 60초를 넘어도 사용자가 시간을 빠르게 파악할 수 있게 하기 위함이다.
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // 2. 분 값이 있을 때만 분 단위를 표시한다.
  // 1분 미만은 `0분`을 붙이지 않아 짧은 신호 시간을 간결하게 보여준다.
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
}

export function useSignalCard(
  signal: PedestrianSignal | undefined,
  onAutoRefresh: () => void,
  onRefresh: () => void,
) {
  const [now, setNow] = useState(() => Date.now());
  const [isRefreshCoolingDown, setIsRefreshCoolingDown] = useState(false);
  const isZeroRetryingRef = useRef(false);
  const refreshCooldownTimerRef = useRef<number | null>(null);

  const handleRefresh = () => {
    // 1. 상태 반영 전 연속 클릭도 막을 수 있도록 타이머 참조를 먼저 잠근다.
    // 자동 재조회와는 별개로 사용자의 수동 호출만 5초에 한 번 허용하기 위한 처리다.
    if (refreshCooldownTimerRef.current !== null) {
      return;
    }

    setIsRefreshCoolingDown(true);
    onRefresh();

    // 2. 쿨다운이 끝나면 타이머 참조와 버튼 상태를 함께 복원한다.
    // 컴포넌트가 유지되는 동안 요청 성공 여부와 무관하게 동일한 제한 시간을 적용한다.
    refreshCooldownTimerRef.current = window.setTimeout(() => {
      refreshCooldownTimerRef.current = null;
      setIsRefreshCoolingDown(false);
    }, SIGNAL_MANUAL_REFRESH_COOLDOWN_MS);
  };

  useEffect(
    () => () => {
      if (refreshCooldownTimerRef.current !== null) {
        window.clearTimeout(refreshCooldownTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!signal) {
      return;
    }

    // 서버를 매초 호출하지 않고 현재 시각만 갱신한다.
    // 수신한 남은 시간에서 경과 시간을 빼는 방식으로 카운트다운하기 위함이다.
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [signal]);

  useEffect(() => {
    if (!signal || signal.isStale) {
      isZeroRetryingRef.current = false;
      return;
    }

    // 1. 유효한 잔여시간 중 가장 짧은 값을 찾는다.
    // 여러 방향이 있어도 가장 먼저 0초가 된 신호를 기준으로 요청 한 번만 보내기 위함이다.
    const validRemainingSeconds = signal.directions
      .map(({ remainingSeconds }) => remainingSeconds)
      .filter(
        (remainingSeconds): remainingSeconds is number =>
          remainingSeconds !== null && remainingSeconds >= 0,
      );

    if (validRemainingSeconds.length === 0) {
      isZeroRetryingRef.current = false;
      return;
    }

    // 2. 0초 표시 후 최초에는 1초, 같은 0초 응답이 이어지면 2초 뒤 재확인한다.
    // 사용자가 0초 상태를 인지할 시간을 주고 API 갱신 전의 같은 응답이 빠르게 반복되는 것도 막는다.
    const receivedTime = new Date(signal.receivedAt).getTime();
    const shortestRemainingSeconds = Math.min(...validRemainingSeconds);

    if (!Number.isFinite(receivedTime)) {
      return;
    }

    const elapsedMilliseconds = Math.max(0, Date.now() - receivedTime);
    const isBelowOneSecond = shortestRemainingSeconds < 1;
    const countdownRefreshDelay = isBelowOneSecond
      ? isZeroRetryingRef.current
        ? SIGNAL_ZERO_RETRY_DELAY_MS
        : SIGNAL_ZERO_INITIAL_REFRESH_DELAY_MS
      : Math.max(
          0,
          shortestRemainingSeconds * 1_000 - elapsedMilliseconds,
        ) + SIGNAL_ZERO_INITIAL_REFRESH_DELAY_MS;

    // 3. 긴 신호는 0초보다 stale 시점이 먼저 올 수 있어 그 직전에 한 번만 동기화한다.
    // 10초 주기 폴링 없이도 유효한 카운트다운이 중간에 정보 없음으로 바뀌는 현상을 방지한다.
    const staleRefreshDelay = Math.max(
      0,
      receivedTime +
        SIGNAL_STALE_AFTER_MS -
        SIGNAL_STALE_REFRESH_LEAD_MS -
        Date.now(),
    );
    const isCountdownRefresh = countdownRefreshDelay <= staleRefreshDelay;
    const refetchDelay = Math.min(countdownRefreshDelay, staleRefreshDelay);

    if (!isBelowOneSecond) {
      isZeroRetryingRef.current = false;
    }

    const timer = window.setTimeout(() => {
      const latestReceivedTime = new Date(signal.receivedAt).getTime();
      const isStillFresh =
        Number.isFinite(latestReceivedTime) &&
        Date.now() - latestReceivedTime <= SIGNAL_STALE_AFTER_MS;

      // 4. 타이머가 끝난 시점에도 데이터가 신선할 때만 재조회한다.
      // 폴링 실패로 오래된 화면이 남은 경우 추가 호출이 반복되는 것을 방지한다.
      if (isStillFresh) {
        isZeroRetryingRef.current = isCountdownRefresh;
        onAutoRefresh();
      }
    }, refetchDelay);

    return () => window.clearTimeout(timer);
  }, [onAutoRefresh, signal]);

  const isStale = useMemo(() => {
    if (!signal) {
      return false;
    }

    const receivedTime = new Date(signal.receivedAt).getTime();
    // 서버가 표시한 stale 상태를 우선 존중하고 클라이언트 경과 시간도 함께 검사한다.
    // 서버가 유효하다고 판단해 전달한 뒤의 경과 시간은 수신 시각을 기준으로 계산한다.
    return (
      signal.isStale ||
      !Number.isFinite(receivedTime) ||
      now - receivedTime > SIGNAL_STALE_AFTER_MS
    );
  }, [now, signal]);

  const directions = useMemo(() => {
    if (!signal) {
      return [];
    }

    // 1. 최신 remainingSeconds를 받은 뒤 클라이언트에서 경과한 시간만 계산한다.
    // 장비 관측 시각의 전송 지연을 다시 차감하면 API 잔여시간보다 화면이 먼저 줄어들기 때문이다.
    const receivedTime = new Date(signal.receivedAt).getTime();
    const elapsedSeconds = Number.isFinite(receivedTime)
      ? Math.max(0, Math.floor((now - receivedTime) / 1_000))
      : 0;

    return signal.directions.map((direction) => {
      // 2. 서버가 준 잔여 시간에서 경과 시간을 차감하되 0 아래로 내려가지 않게 한다.
      const remainingSeconds =
        direction.remainingSeconds === null
          ? null
          : Math.max(0, direction.remainingSeconds - elapsedSeconds);

      // 3. 오래된 데이터는 방향별 원래 상태와 관계없이 정보 없음으로 바꾼다.
      // 지연된 보행 가능 신호를 현재 신호로 오인하는 상황을 막기 위한 안전 처리다.
      return {
        ...direction,
        state: isStale ? ("unknown" as const) : direction.state,
        stateLabel: isStale ? STATE_LABELS.unknown : STATE_LABELS[direction.state],
        remainingLabel:
          isStale || remainingSeconds === null
            ? "—"
            : formatRemainingTime(remainingSeconds),
      };
    });
  }, [isStale, now, signal]);

  const updatedTime = signal
    ? new Intl.DateTimeFormat("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(signal.observedAt))
    : "";

  return {
    directions,
    isStale,
    updatedTime,
    handleRefresh,
    isRefreshCoolingDown,
  };
}
