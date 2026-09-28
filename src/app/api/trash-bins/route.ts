import { NextResponse } from "next/server";

import { getTrashBinsInBounds } from "@/services/trashBin/trashBin.service";
import type { MapBounds } from "@/types/map";

function parseCoordinate(value: string | null): number | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBounds(searchParams: URLSearchParams): MapBounds | null {
  // 1. 네 방향 좌표를 숫자로 변환한다.
  // 일부 값만 누락된 요청이 전체 스냅샷 조회로 이어지지 않도록 모두 확인한다.
  const north = parseCoordinate(searchParams.get("north"));
  const east = parseCoordinate(searchParams.get("east"));
  const south = parseCoordinate(searchParams.get("south"));
  const west = parseCoordinate(searchParams.get("west"));

  // 2. 좌표 범위와 방향 관계를 함께 검증한다.
  // 비정상 경계로 데이터 전체가 반환되거나 잘못된 마커가 노출되는 상황을 막는다.
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
  // 1. 요청 경계를 검증한 뒤에만 스냅샷을 조회한다.
  // 잘못된 입력이 전국 데이터 응답으로 확대되는 것을 차단하기 위한 순서다.
  const searchParams = new URL(request.url).searchParams;
  const bounds = parseBounds(searchParams);
  const version = searchParams.get("version") ?? "v1";

  if (!bounds) {
    return NextResponse.json(
      { message: "유효한 지도 범위를 입력해 주세요." },
      { status: 400 },
    );
  }

  // 2. 지원하는 데이터 버전만 허용한다.
  // 잘못된 값이 서버 내부 스냅샷 조회로 전달되지 않도록 API 경계에서 차단한다.
  if (version !== "v1" && version !== "v2") {
    return NextResponse.json(
      { message: "지원하지 않는 휴지통 데이터 버전입니다." },
      { status: 400 },
    );
  }

  // 3. 현재 화면 안의 휴지통만 반환하고 짧은 공유 캐시를 허용한다.
  // 지도 재이동 시 같은 범위의 정적 데이터를 빠르게 재사용할 수 있다.
  const trashBins = await getTrashBinsInBounds(bounds, version);
  return NextResponse.json(trashBins, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
