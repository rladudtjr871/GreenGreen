import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  API_ACCESS_TOKEN_COOKIE_NAME,
  API_ACCESS_TOKEN_REFRESH_THRESHOLD_SECONDS,
  API_ACCESS_TOKEN_TTL_SECONDS,
} from "@/constants/apiAccess";
import {
  createAccessToken,
  verifyAccessToken,
} from "@/services/security/accessToken";

/** 페이지 요청마다 익명 접근 토큰을 확인하고 없거나 곧 만료되면 새로 발급한다. */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // 1. 유효 시간이 충분히 남은 토큰은 그대로 사용한다.
  // 페이지 이동마다 새 토큰을 만들면 토큰별 호출 횟수 제한이 초기화되기 때문이다.
  const currentToken = await verifyAccessToken(
    request.cookies.get(API_ACCESS_TOKEN_COOKIE_NAME)?.value,
  );
  const nowSeconds = Math.floor(Date.now() / 1_000);

  if (
    currentToken &&
    currentToken.expiresAt - nowSeconds > API_ACCESS_TOKEN_REFRESH_THRESHOLD_SECONDS
  ) {
    return response;
  }

  // 2. 토큰이 없거나 곧 만료되면 새로 발급한다.
  // 비밀키가 설정되지 않았으면 발급하지 않고, API가 401로 거절하도록 둔다.
  const nextToken = await createAccessToken();

  if (!nextToken) {
    console.error("API_ACCESS_TOKEN_SECRET is not configured.");
    return response;
  }

  // 3. 스크립트에서 읽을 수 없는 httpOnly 쿠키로 저장한다.
  // 같은 사이트 요청에만 전송되도록 SameSite=Strict를 사용한다.
  response.cookies.set({
    name: API_ACCESS_TOKEN_COOKIE_NAME,
    value: nextToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: API_ACCESS_TOKEN_TTL_SECONDS,
  });

  return response;
}

export const config = {
  // API, 정적 파일, 이미지 최적화, 확장자가 있는 파일 요청에는 토큰을 발급하지 않는다.
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
