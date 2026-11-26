import { API_ACCESS_TOKEN_TTL_SECONDS } from "@/constants/apiAccess";

/** 검증을 통과한 익명 접근 토큰의 정보다. */
export type AccessTokenPayload = {
  /** 호출 횟수 제한에 사용하는 토큰 고유 ID다. */
  tokenId: string;
  /** 토큰 만료 시각(Unix 초)이다. */
  expiresAt: number;
};

const textEncoder = new TextEncoder();

/** 서버 환경변수에서 토큰 서명용 비밀키를 읽고 없으면 null을 반환한다. */
function getTokenSecret(): string | null {
  // 비밀키는 서버 전용 환경변수에서만 읽어 브라우저 번들에 포함되지 않게 한다.
  return process.env.API_ACCESS_TOKEN_SECRET?.trim() || null;
}

/** 비밀키로 HMAC-SHA256 서명·검증에 사용할 CryptoKey를 만든다. */
function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** 바이트 배열을 URL과 쿠키에 안전한 base64url 문자열로 변환한다. */
function toBase64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

/** 서명된 익명 접근 토큰을 새로 발급하고 비밀키가 없으면 null을 반환한다. */
export async function createAccessToken(): Promise<string | null> {
  const secret = getTokenSecret();

  if (!secret) {
    return null;
  }

  // 1. 토큰마다 고유 ID와 만료 시각을 정한다.
  // ID는 호출 횟수 제한의 기준이 되고, 만료 시각은 탈취된 토큰의 사용 기간을 제한한다.
  const tokenId = crypto.randomUUID();
  const expiresAt =
    Math.floor(Date.now() / 1_000) + API_ACCESS_TOKEN_TTL_SECONDS;
  const body = `${tokenId}.${expiresAt}`;

  // 2. 서버 비밀키로 본문에 서명한다.
  // 클라이언트가 ID나 만료 시각을 바꾸면 서명이 맞지 않아 검증에서 거절된다.
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(body),
  );

  return `${body}.${toBase64Url(signature)}`;
}

/** 익명 접근 토큰의 형식, 서명, 만료를 검증하고 실패하면 null을 반환한다. */
export async function verifyAccessToken(
  token: string | undefined,
): Promise<AccessTokenPayload | null> {
  const secret = getTokenSecret();

  if (!secret || !token) {
    return null;
  }

  // 1. "ID.만료시각.서명" 형식과 각 구간의 허용 문자를 먼저 검사한다.
  // 서명 계산 전에 비정상 입력을 걸러 불필요한 암호 연산을 줄인다.
  const match = /^([0-9a-f-]{36})\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);

  if (!match) {
    return null;
  }

  const [, tokenId, expiresAtText, signatureText] = match;
  const expiresAt = Number(expiresAtText);

  // 2. 만료된 토큰은 서명과 관계없이 거절한다.
  if (expiresAt <= Math.floor(Date.now() / 1_000)) {
    return null;
  }

  // 3. 서명을 검증한다.
  // subtle.verify는 비교 시간을 일정하게 유지해 서명 값을 추측하는 공격에 대비한다.
  const key = await importSigningKey(secret);
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(signatureText, "base64url"),
    textEncoder.encode(`${tokenId}.${expiresAtText}`),
  );

  return isValid ? { tokenId, expiresAt } : null;
}
