import { NextResponse } from "next/server";

import { guardApiRequest } from "@/services/security/apiGuard";
import { parseMapBoundsQuery } from "@/services/map/mapBounds";
import { getIntersectionsInBounds } from "@/services/tData/intersection.service";
import { toTDataErrorResponse } from "@/services/tData/tData.errorResponse";

/** 지도 경계 안의 교차로 목록을 반환한다. */
export async function GET(request: Request) {
  // 1. 출처와 익명 토큰을 확인한다.
  // 서비스 페이지를 거치지 않고 API만 직접 호출하는 요청을 걸러내기 위함이다.
  const guardResponse = await guardApiRequest(request);

  if (guardResponse) {
    return guardResponse;
  }

  // 2. 요청 경계를 먼저 검증해 잘못된 입력은 서비스 계층까지 전달하지 않는다.
  const boundsResult = parseMapBoundsQuery(new URL(request.url).searchParams);

  if (!boundsResult.ok) {
    return NextResponse.json(
      { message: boundsResult.message },
      { status: 400 },
    );
  }

  const { bounds } = boundsResult;

  try {
    // 3. 현재 화면 안의 교차로만 조회한다.
    // 위치 스냅샷은 짧게 캐시해 같은 영역을 반복 이동할 때 응답을 재사용한다.
    const intersections = await getIntersectionsInBounds(bounds);
    return NextResponse.json(intersections, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    // 4. T-Data 오류는 공통 변환기로 사용자용 메시지와 상태 코드만 반환한다.
    return toTDataErrorResponse(error, {
      logLabel: "Unexpected intersections route error.",
      fallbackMessage: "교차로 정보를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
}
