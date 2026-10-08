"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type GuideId = "signals" | "trashBins" | "restrooms";

type GuideItem = {
  id: GuideId;
  label: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  steps: string[];
  tip: string;
  imageLabel: string;
};

export const GUIDE_ITEMS: GuideItem[] = [
  {
    id: "signals",
    label: "신호등",
    icon: "●",
    eyebrow: "PEDESTRIAN SIGNAL",
    title: "보행 신호의 남은 시간을 확인해요",
    description:
      "서울 지역의 지원 교차로에서 현재 보행 신호와 남은 시간을 확인할 수 있습니다.",
    steps: [
      "지도 상단에서 신호등 탭을 선택해 주세요.",
      "교차로 마커가 보일 때까지 지도를 가까이 확대해 주세요.",
      "원하는 교차로 마커를 누르면 신호 상태와 남은 시간이 표시됩니다.",
    ],
    tip: " 제공되는 신호정보는 통신상태에 따라 실제 신호와 차이가 발생할 수 있습니다. 횡단 시 반드시 실제 신호등을 확인하세요.",
    imageLabel: "신호등 탭",
  },
  {
    id: "trashBins",
    label: "쓰레기통",
    icon: "◆",
    eyebrow: "PUBLIC TRASH BIN",
    title: "가까운 공공 쓰레기통을 찾아요",
    description:
      "현재 지도 범위에 등록된 공공 쓰레기통 위치를 마커로 확인할 수 있습니다.",
    steps: [
      "지도 상단에서 휴지통 탭을 선택해 주세요.",
      "위치 마커가 나타날 때까지 지도를 확대해 주세요.",
      "주변 마커를 기준으로 가장 가까운 쓰레기통을 찾아 이동해 주세요.",
    ],
    tip: " 공공데이터의 등록 시점에 따라 실제 위치나 운영 상태가 다를 수 있습니다.",
    imageLabel: "휴지통 탭",
  },
  {
    id: "restrooms",
    label: "화장실",
    icon: "■",
    eyebrow: "PUBLIC RESTROOM",
    title: "공중화장실의 상세 정보를 확인해요",
    description:
      "주변 공중화장실의 위치와 운영시간, 편의시설 정보를 한 번에 살펴볼 수 있습니다.",
    steps: [
      "지도 상단에서 화장실 탭을 선택해 주세요.",
      "화장실 마커가 보일 때까지 지도를 확대해 주세요.",
      "마커를 누르면 주소, 운영시간과 이용 가능한 시설이 표시됩니다.",
    ],
    tip: " 운영시간과 시설 정보는 현장 사정에 따라 달라질 수 있습니다.",
    imageLabel: "화장실 탭",
  },
];

export function useGuideContent() {
  const router = useRouter();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeTab, setActiveTab] = useState<GuideId>("signals");
  const activeGuide =
    GUIDE_ITEMS.find((item) => item.id === activeTab) ?? GUIDE_ITEMS[0];

  const handleClose = () => {
    // 1. 서비스 내부에서 가이드로 이동했다면 이전 지도 화면을 그대로 복원한다.
    // 지도 중심과 탭 상태가 브라우저 기록에 남아 있을 수 있으므로 뒤로가기를 우선한다.
    if (document.referrer) {
      const referrer = new URL(document.referrer);

      if (referrer.origin === window.location.origin) {
        router.back();
        return;
      }
    }

    // 2. 가이드 주소를 직접 연 경우에는 외부 페이지 대신 GreenGreen 홈으로 이동한다.
    router.replace("/");
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    if (![
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ].includes(event.key)) {
      return;
    }

    event.preventDefault();

    // 1. 탭 목록의 양 끝에서 다시 반대쪽으로 순환하도록 다음 위치를 계산한다.
    // 모바일과 키보드 환경 모두에서 세 기능을 끊김 없이 탐색할 수 있게 하기 위함이다.
    let nextIndex = currentIndex;

    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + GUIDE_ITEMS.length) % GUIDE_ITEMS.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % GUIDE_ITEMS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = GUIDE_ITEMS.length - 1;
    }

    // 2. 선택 상태와 실제 키보드 초점을 함께 옮겨 ARIA 탭 동작을 일치시킨다.
    setActiveTab(GUIDE_ITEMS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return {
    activeGuide,
    activeTab,
    handleClose,
    handleTabChange: setActiveTab,
    handleTabKeyDown,
    registerTab: (index: number, element: HTMLButtonElement | null) => {
      tabRefs.current[index] = element;
    },
  };
}
