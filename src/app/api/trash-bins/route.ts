import { NextResponse } from "next/server";

import { guardApiRequest } from "@/services/security/apiGuard";
import { parseMapBoundsQuery } from "@/services/map/mapBounds";
import { getTrashBinsInBounds } from "@/services/trashBin/trashBin.service";

/** 지도 경계 안의 휴지통 목록을 데이터 버전별로 반환한다. */
export async function GET(request: Request) {
  // 1. 출처와 익명 토큰을 확인한다.
  // 서비스 페이지를 거치지 않고 API만 직접 호출하는 요청을 걸러내기 위함이다.
  const guardResponse = await guardApiRequest(request);

  if (guardResponse) {
    return guardResponse;
  }

  // 2. 요청 경계를 검증한 뒤에만 스냅샷을 조회한다.
  // 잘못된 입력이 전국 데이터 응답으로 확대되는 것을 차단하기 위한 순서다.
  const searchParams = new URL(request.url).searchParams;
  const boundsResult = parseMapBoundsQuery(searchParams);
  const version = searchParams.get("version") ?? "v1";

  if (!boundsResult.ok) {
    return NextResponse.json(
      { message: boundsResult.message },
      { status: 400 },
    );
  }

  const { bounds } = boundsResult;

  // 3. 지원하는 데이터 버전만 허용한다.
  // 잘못된 값이 서버 내부 스냅샷 조회로 전달되지 않도록 API 경계에서 차단한다.
  if (version !== "v1" && version !== "v2") {
    return NextResponse.json(
      { message: "지원하지 않는 휴지통 데이터 버전입니다." },
      { status: 400 },
    );
  }

  // 4. 현재 화면 안의 휴지통만 반환하고 짧은 공유 캐시를 허용한다.
  // 지도 재이동 시 같은 범위의 정적 데이터를 빠르게 재사용할 수 있다.
  const trashBins = await getTrashBinsInBounds(bounds, version);
  return NextResponse.json(trashBins, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
