"use client";

import { useEffect, useMemo, useState } from "react";

import { SIGNAL_STALE_AFTER_MS } from "@/constants/signal";
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
  onRemainingTimeEnd: () => void,
) {
  const [now, setNow] = useState(() => Date.now());

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
      return;
    }

    // 1. 유효한 양수 잔여시간 중 가장 짧은 값을 찾는다.
    // 여러 방향이 있어도 가장 먼저 0초가 되는 순간에 요청 한 번만 보내기 위함이다.
    const positiveRemainingSeconds = signal.directions
      .map(({ remainingSeconds }) => remainingSeconds)
      .filter(
        (remainingSeconds): remainingSeconds is number =>
          remainingSeconds !== null && remainingSeconds > 0,
      );

    if (positiveRemainingSeconds.length === 0) {
      return;
    }

    // 2. 응답 수신 뒤 이미 흐른 시간을 제외해 실제 0초 도달 시점에 타이머를 맞춘다.
    // 새 폴링 응답이 오면 기존 타이머를 정리하고 최신 remainingSeconds로 다시 예약한다.
    const receivedTime = new Date(signal.receivedAt).getTime();
    const shortestRemainingSeconds = Math.min(...positiveRemainingSeconds);

    if (!Number.isFinite(receivedTime)) {
      return;
    }

    const elapsedMilliseconds = Math.max(0, Date.now() - receivedTime);
    const refetchDelay = Math.max(
      0,
      shortestRemainingSeconds * 1_000 - elapsedMilliseconds,
    );

    const timer = window.setTimeout(() => {
      const observedTime = new Date(signal.observedAt).getTime();
      const isStillFresh =
        Number.isFinite(observedTime) &&
        Date.now() - observedTime <= SIGNAL_STALE_AFTER_MS;

      // 3. 타이머가 끝난 시점에도 데이터가 신선할 때만 즉시 재조회한다.
      // 폴링 실패로 오래된 화면이 남은 경우 추가 호출이 반복되는 것을 방지한다.
      if (isStillFresh) {
        onRemainingTimeEnd();
      }
    }, refetchDelay);

    return () => window.clearTimeout(timer);
  }, [onRemainingTimeEnd, signal]);

  const isStale = useMemo(() => {
    if (!signal) {
      return false;
    }

    const observedTime = new Date(signal.observedAt).getTime();
    // 서버가 표시한 stale 상태를 우선 존중하고 클라이언트 경과 시간도 함께 검사한다.
    // 다음 폴링 전 데이터가 임계 시간을 넘더라도 현재 신호처럼 보이지 않게 한다.
    return (
      signal.isStale ||
      !Number.isFinite(observedTime) ||
      now - observedTime > SIGNAL_STALE_AFTER_MS
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

  return { directions, isStale, updatedTime };
}
