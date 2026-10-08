"use client";

import { useEffect, useRef, useState } from "react";

export function useFaqMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      // 1. 메뉴 바깥에서 시작된 입력만 닫기 동작으로 처리한다.
      // 링크나 FAQ 버튼을 누를 때 먼저 닫혀 탐색이 취소되는 상황을 피하기 위한 순서다.
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // 2. 키보드 사용자가 지도 조작으로 돌아가기 쉽도록 Escape로 메뉴를 닫는다.
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return {
    isOpen,
    menuRef,
    toggleMenu: () => setIsOpen((current) => !current),
  };
}
