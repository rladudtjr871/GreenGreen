import { NextResponse } from "next/server";

import {
  SIGNAL_RATE_LIMIT_MAX_REQUESTS,
  SIGNAL_RATE_LIMIT_WINDOW_MS,
} from "@/constants/apiAccess";
import { guardApiRequest } from "@/services/security/apiGuard";
import { getPedestrianSignal } from "@/services/tData/signal.service";
import { toTDataErrorResponse } from "@/services/tData/tData.errorResponse";

type SignalRouteContext = {
  /** 동적 경로에서 전달되는 T-Data 교차로 식별자다. */
  params: Promise<{
    /** URL의 `[intersectionId]` 구간에서 읽은 원본 문자열이다. */
    intersectionId: string;
  }>;
};

/** 선택한 교차로의 실시간 보행 신호를 캐시 없이 반환한다. */
export async function GET(request: Request, context: SignalRouteContext) {
  // 1. 출처와 익명 토큰을 확인하고 토큰별 호출 횟수를 제한한다.
  // 이 API는 외부 T-Data 일일 호출 한도를 소모하므로 반복 호출로 한도가 고갈되지 않게 한다.
  const guardResponse = await guardApiRequest(request, {
    rateLimit: {
      scope: "signals",
      maxRequests: SIGNAL_RATE_LIMIT_MAX_REQUESTS,
      windowMs: SIGNAL_RATE_LIMIT_WINDOW_MS,
    },
  });

  if (guardResponse) {
    return guardResponse;
  }

  // 2. 경로 ID를 검증해 의도하지 않은 값이 외부 API 파라미터로 전달되지 않게 한다.
  const { intersectionId } = await context.params;

  if (!/^\d{1,10}$/.test(intersectionId)) {
    return NextResponse.json(
      { message: "유효한 교차로 ID를 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    // 3. 검증된 교차로의 최신 신호를 서버에서 조회한다.
    const signal = await getPedestrianSignal(intersectionId);

    // 4. 정상 응답이지만 제공 데이터가 없으면 오류와 구분되는 404를 반환한다.
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
    // 5. T-Data 오류는 공통 변환기로 사용자용 메시지와 상태 코드만 반환한다.
    return toTDataErrorResponse(error, {
      logLabel: "Unexpected signal route error.",
      fallbackMessage: "신호정보를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
}
