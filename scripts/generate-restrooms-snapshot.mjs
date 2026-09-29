import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = process.argv.slice(2).find((argument) => argument !== "--");
const outputPath = path.resolve("src/data/restrooms.json");

if (!sourcePath) {
  throw new Error("원본 JSON 파일 경로를 입력해 주세요.");
}

function cleanText(value) {
  const normalized = String(value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(" · ");

  return normalized || null;
}

// 1. 서울시 원본 JSON의 DATA 배열만 읽는다.
// DESCRIPTION은 필드 설명이므로 지도 데이터에 포함하지 않아 번들 크기를 줄인다.
const source = JSON.parse(await readFile(path.resolve(sourcePath), "utf8"));

if (!Array.isArray(source.DATA)) {
  throw new Error("원본 JSON에서 DATA 배열을 찾지 못했습니다.");
}

// 2. 외부 필드명을 앱 내부 Restroom 모델로 변환한다.
// 파이프 구분 문자열은 팝업에서 읽기 쉬운 가운데점 구분 문자열로 정리한다.
const restrooms = source.DATA.map((row) => ({
  restroomId: `seoul-restroom-${row.objectid}`,
  name: cleanText(row.conts_name),
  district: cleanText(row.gu_name),
  roadAddress: cleanText(row.addr_new),
  lotAddress: cleanText(row.addr_old),
  restroomType: cleanText(row.value_01),
  openingHours: cleanText(row.value_02),
  availability: cleanText(row.value_04),
  accessibleAvailability: cleanText(row.value_05),
  locationCategory: cleanText(row.value_08),
  closedDays: cleanText(row.value_03),
  facilities: cleanText(row.value_06),
  safetyFacilities: cleanText(row.value_07),
  telephone: cleanText(row.tel_no),
  note: cleanText(row.value_09),
  coordinate: {
    latitude: Number(row.coord_y),
    longitude: Number(row.coord_x),
  },
}));

// 3. 좌표와 식별자가 유효한 행만 저장한다.
// 잘못된 행이 지도 원점 등에 표시되는 문제와 중복 마커 생성을 방지한다.
const seenIds = new Set();
const validRestrooms = restrooms.filter((restroom) => {
  const isValid =
    restroom.name !== null &&
    restroom.name.length > 0 &&
    !seenIds.has(restroom.restroomId) &&
    Number.isFinite(restroom.coordinate.latitude) &&
    Number.isFinite(restroom.coordinate.longitude);

  if (isValid) {
    seenIds.add(restroom.restroomId);
  }

  return isValid;
});

await writeFile(outputPath, `${JSON.stringify(validRestrooms, null, 2)}\n`, "utf8");
console.log(`${validRestrooms.length}개의 화장실 정보를 ${outputPath}에 저장했습니다.`);
