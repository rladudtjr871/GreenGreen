import { SignJWT, jwtVerify } from "jose";

import { API_ACCESS_TOKEN_TTL_SECONDS } from "@/constants/apiAccess";

/** 검증을 통과한 익명 접근 토큰의 정보다. */
export type AccessTokenPayload = {
  /** 호출 횟수 제한에 사용하는 토큰 고유 ID(JWT jti)다. */
  tokenId: string;
  /** 토큰 만료 시각(JWT exp, Unix 초)이다. */
  expiresAt: number;
};

/** JWT 서명과 검증에 사용하는 알고리즘이다. 검증 시 이 값만 허용해 알고리즘 바꿔치기를 막는다. */
const JWT_ALGORITHM = "HS256";
/** 토큰을 발급한 주체(iss)로, 다른 용도로 만든 JWT가 섞여 들어오는 것을 구분한다. */
const JWT_ISSUER = "greengreen";
/** 토큰을 사용할 대상(aud)으로, 이 서비스의 API 접근용 토큰임을 표시한다. */
const JWT_AUDIENCE = "greengreen-api";

const textEncoder = new TextEncoder();

/** 서버 환경변수에서 JWT 서명용 비밀키를 읽어 바이트로 변환하고 없으면 null을 반환한다. */
function getTokenSecret(): Uint8Array | null {
  // 비밀키는 서버 전용 환경변수에서만 읽어 브라우저 번들에 포함되지 않게 한다.
  const secret = process.env.API_ACCESS_TOKEN_SECRET?.trim();
  return secret ? textEncoder.encode(secret) : null;
}

/** 서명된 익명 접근 JWT를 새로 발급하고 비밀키가 없으면 null을 반환한다. */
export async function createAccessToken(): Promise<string | null> {
  const secret = getTokenSecret();

  if (!secret) {
    return null;
  }

  // 1. 토큰마다 고유 ID(jti)와 만료 시각(exp)을 넣는다.
  // jti는 호출 횟수 제한의 기준이 되고, exp는 탈취된 토큰의 사용 기간을 제한한다.
  // 2. 서버 비밀키로 HS256 서명한다.
  // 클라이언트가 페이로드를 바꾸면 서명이 맞지 않아 검증에서 거절된다.
  return new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: "JWT" })
    .setJti(crypto.randomUUID())
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${API_ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

/** 익명 접근 JWT의 서명, 알고리즘, 발급자, 대상, 만료를 검증하고 실패하면 null을 반환한다. */
export async function verifyAccessToken(
  token: string | undefined,
): Promise<AccessTokenPayload | null> {
  const secret = getTokenSecret();

  if (!secret || !token) {
    return null;
  }

  try {
    // 1. 허용 알고리즘을 HS256 하나로 고정하고 발급자와 대상까지 확인한다.
    // 헤더의 alg 값을 그대로 믿으면 alg 변조 공격에 노출되므로 서버가 기대하는 값으로만 검증한다.
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    // 2. 호출 횟수 제한에 필요한 jti와 exp가 있는 토큰만 통과시킨다.
    if (typeof payload.jti !== "string" || typeof payload.exp !== "number") {
      return null;
    }

    return { tokenId: payload.jti, expiresAt: payload.exp };
  } catch {
    // 3. 서명 불일치, 만료, 형식 오류는 모두 같은 실패로 처리한다.
    // 실패 원인을 구분해 응답하면 토큰 위조 시도에 단서를 줄 수 있기 때문이다.
    return null;
  }
}
