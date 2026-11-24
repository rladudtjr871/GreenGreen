import { NextResponse } from "next/server";

import { getIntersectionsInBounds } from "@/services/tData/intersection.service";
import { TDataApiError } from "@/services/tData/tData.client";
import type { MapBounds } from "@/types/map";

function parseCoordinate(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBounds(searchParams: URLSearchParams): MapBounds | null {
  // 1. 네 좌표를 모두 숫자로 변환한다.
  const north = parseCoordinate(searchParams.get("north"));
  const east = parseCoordinate(searchParams.get("east"));
  const south = parseCoordinate(searchParams.get("south"));
  const west = parseCoordinate(searchParams.get("west"));

  // 2. 누락 값, 뒤집힌 경계, 좌표 범위를 함께 검증한다.
  // 유효하지 않은 범위로 전체 데이터가 반환되는 상황을 차단한다.
  if (
    north === null ||
    east === null ||
    south === null ||
    west === null ||
    north <= south ||
    east <= west ||
    north > 90 ||
    south < -90 ||
    east > 180 ||
    west < -180
  ) {
    return null;
  }

  return { north, east, south, west };
}

export async function GET(request: Request) {
  // 1. 요청 경계를 먼저 검증해 잘못된 입력은 서비스 계층까지 전달하지 않는다.
  const bounds = parseBounds(new URL(request.url).searchParams);

  if (!bounds) {
    return NextResponse.json(
      { message: "유효한 지도 범위를 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    // 2. 현재 화면 안의 교차로만 조회한다.
    // 위치 스냅샷은 짧게 캐시해 같은 영역을 반복 이동할 때 응답을 재사용한다.
    const intersections = await getIntersectionsInBounds(bounds);
    return NextResponse.json(intersections, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    // 3. 사용자용으로 정제된 T-Data 오류만 메시지와 상태 코드를 그대로 전달한다.
    // 서버 설정 오류(500)는 환경변수 이름 같은 내부 정보를 담고 있어 노출하지 않는다.
    if (error instanceof TDataApiError && error.status !== 500) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }

    // 4. 그 밖의 오류는 원인을 서버 로그에만 남기고 클라이언트에는 공통 메시지를 반환한다.
    // 예기치 않은 Error의 message에는 구현 세부사항이 포함될 수 있기 때문이다.
    console.error("Unexpected intersections route error.", error);

    return NextResponse.json(
      { message: "교차로 정보를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
