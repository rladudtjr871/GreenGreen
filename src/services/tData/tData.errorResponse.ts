import { NextResponse } from "next/server";

import { TDataApiError } from "@/services/tData/tData.client";

type TDataErrorResponseOptions = {
  /** 예기치 않은 오류를 서버 로그에서 구분하기 위한 Route별 라벨이다. */
  logLabel: string;
  /** 예기치 않은 오류일 때 클라이언트에 보여줄 사용자용 메시지다. */
  fallbackMessage: string;
};

/** T-Data 관련 오류를 사용자용 메시지와 상태 코드의 응답으로 변환한다. */
export function toTDataErrorResponse(
  error: unknown,
  { logLabel, fallbackMessage }: TDataErrorResponseOptions,
): NextResponse {
  // 1. TDataApiError는 tData.client에서 사용자용 메시지로만 만들어지므로 그대로 전달한다.
  // 호출 한도(429), 연결 실패(503) 같은 상태를 클라이언트가 구분할 수 있게 하기 위함이다.
  if (error instanceof TDataApiError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status },
    );
  }

  // 2. 그 밖의 오류는 원인을 서버 로그에만 남기고 클라이언트에는 공통 메시지를 반환한다.
  // 설정 누락이나 예기치 않은 Error의 message에는 구현 세부사항이 포함될 수 있기 때문이다.
  console.error(logLabel, error);

  return NextResponse.json({ message: fallbackMessage }, { status: 500 });
}
