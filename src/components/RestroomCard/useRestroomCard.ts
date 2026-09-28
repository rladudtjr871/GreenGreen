"use client";

import { useMemo } from "react";

import type { Restroom } from "@/types/restroom";

type RestroomDetail = {
  label: string;
  value: string;
};

export function useRestroomCard(restroom: Restroom) {
  const address = restroom.roadAddress || restroom.lotAddress;

  const details = useMemo<RestroomDetail[]>(() => {
    // 1. 원본에 값이 있는 항목만 상세 목록으로 만든다.
    // 빈 필드가 많은 공공데이터 특성상 의미 없는 행을 숨겨 팝업을 간결하게 유지한다.
    const candidates: RestroomDetail[] = [
      { label: "개방 시간", value: restroom.openingHours },
      { label: "화장실 현황", value: restroom.availability },
      { label: "장애인 화장실", value: restroom.accessibleAvailability },
      { label: "위치 유형", value: restroom.locationCategory },
      { label: "휴무일", value: restroom.closedDays },
      { label: "편의시설", value: restroom.facilities },
      { label: "안내·안전시설", value: restroom.safetyFacilities },
      { label: "전화번호", value: restroom.telephone },
    ];

    // 2. 주소와 중복되는 비고는 제외하고, 다른 설명일 때만 마지막에 보여준다.
    // 시설명이 그대로 반복되는 경우 불필요하게 팝업이 길어지는 것을 방지한다.
    if (restroom.note && restroom.note !== restroom.name) {
      candidates.push({ label: "비고", value: restroom.note });
    }

    return candidates.filter(({ value }) => value.length > 0);
  }, [restroom]);

  return { address, details };
}
