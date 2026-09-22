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
    // 4. T-Data의 제어 가능한 상태 코드는 보존하고 예기치 않은 오류는 500으로 처리한다.
    const status = error instanceof TDataApiError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : "신호정보를 가져오는 중 문제가 발생했습니다.";

    return NextResponse.json({ message }, { status });
  }
}
