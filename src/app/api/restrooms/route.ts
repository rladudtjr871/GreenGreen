import { NextResponse } from "next/server";

import { guardApiRequest } from "@/services/security/apiGuard";
import { parseMapBoundsQuery } from "@/services/map/mapBounds";
import { getRestroomsInBounds } from "@/services/restroom/restroom.service";

/** 지도 경계 안의 공중화장실 목록을 반환한다. */
export async function GET(request: Request) {
  // 1. 출처와 익명 토큰을 확인한다.
  // 서비스 페이지를 거치지 않고 API만 직접 호출하는 요청을 걸러내기 위함이다.
  const guardResponse = await guardApiRequest(request);

  if (guardResponse) {
    return guardResponse;
  }

  // 2. 요청 경계를 검증한 뒤에만 정적 스냅샷을 조회한다.
  // 잘못된 요청에 전체 데이터를 반환하지 않도록 API 경계에서 차단한다.
  const boundsResult = parseMapBoundsQuery(new URL(request.url).searchParams);

  if (!boundsResult.ok) {
    return NextResponse.json(
      { message: boundsResult.message },
      { status: 400 },
    );
  }

  const { bounds } = boundsResult;

  // 3. 현재 화면 안의 화장실만 반환하고 공유 캐시를 허용한다.
  // 데이터가 정적이므로 같은 지도 범위 요청을 안전하게 재사용할 수 있다.
  const restrooms = await getRestroomsInBounds(bounds);
  return NextResponse.json(restrooms, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
