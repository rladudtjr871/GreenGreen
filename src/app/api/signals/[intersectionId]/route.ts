import { NextResponse } from "next/server";

import { getPedestrianSignal } from "@/services/tData/signal.service";
import { TDataApiError } from "@/services/tData/tData.client";

type SignalRouteContext = {
  /** 동적 경로에서 전달되는 T-Data 교차로 식별자다. */
  params: Promise<{
    /** URL의 `[intersectionId]` 구간에서 읽은 원본 문자열이다. */
    intersectionId: string;
  }>;
};

export async function GET(_request: Request, context: SignalRouteContext) {
  // 1. 경로 ID를 검증해 의도하지 않은 값이 외부 API 파라미터로 전달되지 않게 한다.
  const { intersectionId } = await context.params;

  if (!/^\d{1,10}$/.test(intersectionId)) {
    return NextResponse.json(
      { message: "유효한 교차로 ID를 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    // 2. 검증된 교차로의 최신 신호를 서버에서 조회한다.
    const signal = await getPedestrianSignal(intersectionId);

    // 3. 정상 응답이지만 제공 데이터가 없으면 오류와 구분되는 404를 반환한다.
    if (!signal) {
      return NextResponse.json(
        { message: "현재 제공되는 신호정보가 없습니다." },
        { status: 404 },
      );
    }

    // 실시간 값이 브라우저나 중간 캐시에 남지 않도록 명시적으로 저장을 금지한다.
    return NextResponse.json(signal, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // 4. 사용자용으로 정제된 T-Data 오류만 메시지와 상태 코드를 그대로 전달한다.
    // 서버 설정 오류(500)는 환경변수 이름 같은 내부 정보를 담고 있어 노출하지 않는다.
    if (error instanceof TDataApiError && error.status !== 500) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    // 5. 그 밖의 오류는 원인을 서버 로그에만 남기고 클라이언트에는 공통 메시지를 반환한다.
    // 예기치 않은 Error의 message에는 구현 세부사항이 포함될 수 있기 때문이다.
    console.error("Unexpected signal route error.", error);

    return NextResponse.json(
      { message: "신호정보를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
