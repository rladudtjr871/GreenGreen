import type { ContactRequest } from "@/types/contact";

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
export class EmailServiceError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "EmailServiceError";
    this.statusCode = statusCode;
  }
}

export async function sendContactEmail(
  { title, message }: ContactRequest,
  origin: string,
) {
  // 1. Public Key는 서버 환경변수에서만 읽어 브라우저 번들에 포함되지 않게 한다.
  // 값이 없으면 외부 API를 호출하기 전에 설정 오류를 명확히 감지할 수 있다.
  const publicKey = process.env.EMAIL_API_KEY?.trim();
  const serviceId = process.env.EMAIL_SERVICE_ID?.trim();
  const templateId = process.env.EMAIL_TEMPLATE_ID?.trim();

  if (!publicKey || !serviceId || !templateId) {
    console.error("EmailJS configuration is incomplete.", {
      hasPublicKey: Boolean(publicKey),
      hasServiceId: Boolean(serviceId),
      hasTemplateId: Boolean(templateId),
    });
    throw new EmailServiceError("문의 메일 전송 설정을 확인해 주세요.", 500);
  }

  // 2. 검증이 끝난 문의만 EmailJS 템플릿 변수로 전달한다.
  // 수신 주소는 EmailJS 템플릿에 고정하여 사용자가 임의로 바꾸지 못하게 한다.
  let response: Response;

  try {
    response = await fetch(EMAILJS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: { title, message },
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("EmailJS request could not be completed.", error);
    throw new EmailServiceError(
      "문의 메일 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  }

  // 3. EmailJS 오류 본문에는 외부 서비스 정보가 포함될 수 있어 사용자에게 그대로 노출하지 않는다.
  if (!response.ok) {
    const responseText = (await response.text()).slice(0, 500);

    console.error("EmailJS rejected the contact email.", {
      status: response.status,
      response: responseText,
    });

    if (response.status === 429) {
      throw new EmailServiceError(
        "문의가 연속으로 접수되었습니다. 잠시 후 다시 시도해 주세요.",
        429,
      );
    }

    throw new EmailServiceError(
      "문의를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  }
}
