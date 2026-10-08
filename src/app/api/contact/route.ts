import { NextResponse } from "next/server";

import {
  EmailServiceError,
  sendContactEmail,
} from "@/services/email/email.service";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_TITLE_MAX_LENGTH,
  type ContactFieldErrors,
  type ContactRequest,
} from "@/types/contact";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateContactRequest(value: unknown): {
  data: ContactRequest | null;
  errors: ContactFieldErrors;
} {
  const errors: ContactFieldErrors = {};

  // 1. 요청 본문을 신뢰하지 않고 문자열 필드인지 확인한 뒤 공백을 정리한다.
  // 클라이언트 검사를 우회한 요청도 외부 메일 서비스로 전달되지 않게 하기 위함이다.
  const title = isRecord(value) && typeof value.title === "string"
    ? value.title.trim()
    : "";
  const message = isRecord(value) && typeof value.message === "string"
    ? value.message.trim()
    : "";

  // 2. 필수 입력과 길이 제한을 서버에서 다시 검사한다.
  if (!title) {
    errors.title = "문의 제목을 입력해 주세요.";
  } else if (title.length > CONTACT_TITLE_MAX_LENGTH) {
    errors.title = `문의 제목은 ${CONTACT_TITLE_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  if (!message) {
    errors.message = "문의 내용을 입력해 주세요.";
  } else if (message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    errors.message = `문의 내용은 ${CONTACT_MESSAGE_MAX_LENGTH}자 이하로 입력해 주세요.`;
  }

  // 3. 오류가 하나라도 있으면 정제된 데이터를 만들지 않아 전송 경로를 차단한다.
  return {
    data: Object.keys(errors).length === 0 ? { title, message } : null,
    errors,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  // 1. JSON이 아닌 요청은 잘못된 입력으로 즉시 반환한다.
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "올바른 문의 내용을 입력해 주세요." },
      { status: 400 },
    );
  }

  // 2. 서버 검증을 통과한 문의만 EmailJS로 전송한다.
  const { data, errors } = validateContactRequest(body);

  if (!data) {
    return NextResponse.json(
      { message: "입력한 문의 내용을 확인해 주세요.", errors },
      { status: 400 },
    );
  }

  try {
    // 3. 수신 주소가 고정된 EmailJS 템플릿으로 제목과 내용만 전달한다.
    const requestUrl = new URL(request.url);
    const browserOrigin = request.headers.get("origin");
    const origin = browserOrigin === requestUrl.origin
      ? browserOrigin
      : requestUrl.origin;

    await sendContactEmail(data, origin);
    return NextResponse.json({ message: "문의가 전송되었습니다." });
  } catch (error) {
    const message =
      error instanceof EmailServiceError
        ? error.message
        : "문의를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.";

    const status = error instanceof EmailServiceError ? error.statusCode : 502;

    if (!(error instanceof EmailServiceError)) {
      console.error("Unexpected contact email error.", error);
    }

    return NextResponse.json({ message }, { status });
  }
}
