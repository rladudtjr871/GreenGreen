"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function useContactForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleClose = () => {
    // 1. 같은 서비스 안에서 문의 화면으로 들어왔다면 원래 보던 지도 상태로 돌아간다.
    // 브라우저 뒤로가기를 우선해야 사용자가 보고 있던 지도 흐름을 자연스럽게 이어갈 수 있다.
    if (document.referrer) {
      const referrer = new URL(document.referrer);

      if (referrer.origin === window.location.origin) {
        router.back();
        return;
      }
    }

    // 2. 주소를 직접 열었거나 외부에서 들어온 경우에는 서비스 밖으로 나가지 않도록 홈으로 이동한다.
    router.replace("/");
  };

  return {
    title,
    content,
    handleClose,
    handleTitleChange: (event: ChangeEvent<HTMLInputElement>) =>
      setTitle(event.target.value),
    handleContentChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
      setContent(event.target.value),
  };
}
