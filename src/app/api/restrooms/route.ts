import { NextResponse } from "next/server";

import { getRestroomsInBounds } from "@/services/restroom/restroom.service";
import type { MapBounds } from "@/types/map";

function parseCoordinate(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBounds(searchParams: URLSearchParams): MapBounds | null {
  // 1. 네 방향 좌표가 모두 유효한 숫자인지 확인한다.
  // 일부 값만 있는 요청이 전체 스냅샷 조회로 이어지는 것을 방지한다.
  const north = parseCoordinate(searchParams.get("north"));
  const east = parseCoordinate(searchParams.get("east"));
  const south = parseCoordinate(searchParams.get("south"));
  const west = parseCoordinate(searchParams.get("west"));

  // 2. 좌표 범위와 방향 관계를 함께 검증한다.
  // 잘못된 경계로 예상하지 못한 마커가 응답되는 상황을 차단한다.
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
  // 1. 요청 경계를 검증한 뒤에만 정적 스냅샷을 조회한다.
  // 잘못된 요청에 전체 데이터를 반환하지 않도록 API 경계에서 차단한다.
  const bounds = parseBounds(new URL(request.url).searchParams);

  if (!bounds) {
    return NextResponse.json(
      { message: "유효한 지도 범위를 입력해 주세요." },
      { status: 400 },
    );
  }

  // 2. 현재 화면 안의 화장실만 반환하고 공유 캐시를 허용한다.
  // 데이터가 정적이므로 같은 지도 범위 요청을 안전하게 재사용할 수 있다.
  const restrooms = await getRestroomsInBounds(bounds);
  return NextResponse.json(restrooms, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
