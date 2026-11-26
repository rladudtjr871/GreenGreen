import { NextResponse } from "next/server";

import {
  API_ACCESS_TOKEN_COOKIE_NAME,
  API_INVALID_REQUEST_MESSAGE,
  API_RATE_LIMITED_MESSAGE,
  API_TOKEN_EXPIRED_MESSAGE,
} from "@/constants/apiAccess";
import { verifyAccessToken } from "@/services/security/accessToken";
import { consumeRateLimit } from "@/services/security/rateLimit";

type ApiGuardOptions = {
  /** 토큰별 호출 횟수 제한 설정이며 없으면 횟수를 세지 않는다. */
  rateLimit?: {
    /** 같은 API의 기록을 다른 API와 구분하기 위한 이름이다. */
    scope: string;
    /** 구간 안에서 허용하는 최대 호출 횟수다. */
    maxRequests: number;
    /** 호출 횟수를 세는 구간 길이(ms)다. */
    windowMs: number;
  };
};

/** 오류 응답을 만들고 중간 캐시에 저장되지 않도록 no-store를 붙인다. */
function errorResponse(
  message: string,
  status: number,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

/** Cookie 헤더에서 이름이 일치하는 쿠키 값을 찾는다. */
function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex > 0 && part.slice(0, separatorIndex).trim() === name) {
      return part.slice(separatorIndex + 1).trim();
    }
  }

  return undefined;
}

/** 브라우저가 보낸 출처 정보가 있을 때 우리 사이트에서 보낸 요청인지 확인한다. */
function isSameOriginRequest(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin;

  // 1. 최신 브라우저가 붙이는 Sec-Fetch-Site로 다른 사이트나 주소창 직접 입력 요청을 거절한다.
  // 스크립트는 이 헤더를 생략할 수 있어 헤더가 없을 때는 토큰 검사에 맡긴다.
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite !== null && fetchSite !== "same-origin") {
    return false;
  }

  // 2. Origin이나 Referer가 있으면 우리 도메인과 일치해야 한다.
  // 다른 웹사이트가 방문자 브라우저를 통해 우리 API를 호출하는 것을 막기 위함이다.
  const origin = request.headers.get("origin");

  if (origin !== null && origin !== expectedOrigin) {
    return false;
  }

  const referer = request.headers.get("referer");

  if (referer !== null) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return true;
}

/** 출처, 익명 토큰, 호출 횟수를 검사하고 거절할 때만 오류 응답을 반환한다. */
export async function guardApiRequest(
  request: Request,
  options: ApiGuardOptions = {},
): Promise<NextResponse | null> {
  // 1. 다른 사이트에서 온 요청은 토큰 검사 전에 거절한다.
  if (!isSameOriginRequest(request)) {
    return errorResponse(API_INVALID_REQUEST_MESSAGE, 403);
  }

  // 2. 페이지 접속 시 발급한 서명 토큰이 있어야 API를 사용할 수 있다.
  // 주소만 알고 API를 바로 호출하는 요청을 걸러내고, 호출 횟수 제한의 기준 ID를 얻는다.
  const token = await verifyAccessToken(
    readCookie(request, API_ACCESS_TOKEN_COOKIE_NAME),
  );

  if (!token) {
    return errorResponse(API_TOKEN_EXPIRED_MESSAGE, 401);
  }

  // 3. 호출 횟수 제한이 설정된 API만 토큰별로 횟수를 센다.
  // 외부 API 한도를 소모하는 경로를 반복 호출로 고갈시키지 못하게 하기 위함이다.
  const { rateLimit } = options;

  if (
    rateLimit &&
    !consumeRateLimit(
      `${rateLimit.scope}:${token.tokenId}`,
      rateLimit.maxRequests,
      rateLimit.windowMs,
    )
  ) {
    return errorResponse(API_RATE_LIMITED_MESSAGE, 429, {
      "Retry-After": String(Math.ceil(rateLimit.windowMs / 1_000)),
    });
  }

  return null;
}
