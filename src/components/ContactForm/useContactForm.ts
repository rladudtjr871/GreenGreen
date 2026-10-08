"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { sendContactInquiry } from "@/services/greenGreenApi";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_TITLE_MAX_LENGTH,
  type ContactFieldErrors,
} from "@/types/contact";

function validateContactForm(
  title: string,
  message: string,
): ContactFieldErrors {
  const errors: ContactFieldErrors = {};

  // 1. 공백만 입력한 값은 실제 문의 내용으로 볼 수 없으므로 필수 오류로 처리한다.
  if (!title.trim()) {
    errors.title = "문의 제목을 입력해 주세요.";
  } else if (title.trim().length > CONTACT_TITLE_MAX_LENGTH) {
    errors.title = `문의 제목은 ${CONTACT_TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  // 2. 지나치게 긴 본문은 실수로 붙여 넣은 입력과 외부 API 제한 문제를 예방하기 위해 차단한다.
  if (!message.trim()) {
    errors.message = "문의 내용을 입력해 주세요.";
  } else if (message.trim().length > CONTACT_MESSAGE_MAX_LENGTH) {
    errors.message = `문의 내용은 ${CONTACT_MESSAGE_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  return errors;
}

export function useContactForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);
    setFieldErrors((current) => ({ ...current, title: undefined }));
  };

  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    setFieldErrors((current) => ({ ...current, message: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // 1. 현재 입력을 먼저 검사하여 잘못된 문의가 네트워크 요청으로 이어지지 않게 한다.
    const errors = validateContactForm(title, content);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setSubmitStatus("error");
      setSubmitMessage("입력한 문의 내용을 확인해 주세요.");
      return;
    }

    // 2. 전송 중에는 버튼을 잠가 EmailJS에 같은 문의가 중복 등록되지 않게 한다.
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setSubmitMessage("");

    try {
      // 3. 앞뒤 공백을 제거한 값만 서버에 전달하고 성공 후 폼을 초기화한다.
      const message = await sendContactInquiry({
        title: title.trim(),
        message: content.trim(),
      });

      setTitle("");
      setContent("");
      setFieldErrors({});
      setSubmitStatus("success");
      setSubmitMessage(message);
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(
        error instanceof Error
          ? error.message
          : "문의를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
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
  };
}
