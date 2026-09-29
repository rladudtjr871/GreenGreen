import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = process.argv.slice(2).find((argument) => argument !== "--");
const outputPath = path.resolve("src/data/restrooms.json");

if (!sourcePath) {
  throw new Error("병합할 화장실 JSON 파일 경로를 입력해 주세요.");
}

function nullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function createRestroomId(restroom) {
  const key = [
    restroom.name,
    restroom.lotAddress,
    restroom.roadAddress,
    restroom.coordinate.latitude,
    restroom.coordinate.longitude,
  ].join("|");
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return `public-restroom-${digest}`;
}

function createNaturalKey({ name, coordinate }) {
  return [
    name.trim(),
    coordinate.latitude.toFixed(7),
    coordinate.longitude.toFixed(7),
  ].join("|");
}

// 1. 전달받은 JSON에서 요청한 이름·주소·좌표 필드만 추출한다.
// 검색 결과의 순위, 전화번호, 리뷰 같은 부가 필드는 스냅샷에 포함하지 않는다.
const source = JSON.parse(await readFile(path.resolve(sourcePath), "utf8"));

if (!Array.isArray(source)) {
  throw new Error("화장실 원본 JSON은 배열 형식이어야 합니다.");
}

const sourceRestrooms = source.map((row) => {
  const restroom = {
    restroomId: "",
    name: nullableText(row.name),
    district: null,
    roadAddress: nullableText(row.roadAddress),
    lotAddress: nullableText(row.address),
    restroomType: null,
    openingHours: null,
    availability: null,
    accessibleAvailability: null,
    locationCategory: null,
    closedDays: null,
    facilities: null,
    safetyFacilities: null,
    telephone: null,
    note: null,
    coordinate: {
      latitude: Number(row.y),
      longitude: Number(row.x),
    },
  };

  restroom.restroomId = restroom.name ? createRestroomId(restroom) : "";
  return restroom;
});

const invalidRows = sourceRestrooms.filter(
  ({ name, coordinate }) =>
    !name ||
    !Number.isFinite(coordinate.latitude) ||
    !Number.isFinite(coordinate.longitude),
);

if (invalidRows.length > 0) {
  throw new Error(`유효하지 않은 화장실 행이 ${invalidRows.length}건 있습니다.`);
}

// 2. 이름과 좌표가 같은 기존 행은 ID를 유지하며 갱신하고, 나머지는 신규 추가한다.
// 같은 JSON을 다시 반영해도 동일한 화장실이 중복 생성되지 않게 한다.
const existingRestrooms = JSON.parse(await readFile(outputPath, "utf8"));
const existingByNaturalKey = new Map(
  existingRestrooms.map((restroom) => [createNaturalKey(restroom), restroom]),
);
const mergedById = new Map(
  existingRestrooms.map((restroom) => [restroom.restroomId, restroom]),
);
let addedCount = 0;
let updatedCount = 0;

for (const sourceRestroom of sourceRestrooms) {
  const existing = existingByNaturalKey.get(createNaturalKey(sourceRestroom));
  const restroom = existing
    ? { ...sourceRestroom, restroomId: existing.restroomId }
    : sourceRestroom;

  if (existing) {
    updatedCount += 1;
  } else {
    addedCount += 1;
  }

  mergedById.set(restroom.restroomId, restroom);
}

// 3. 기존 순서는 보존하고 새 행만 뒤에 추가해 대규모 불필요한 diff를 피한다.
const mergedRestrooms = [...mergedById.values()];
await writeFile(
  outputPath,
  `${JSON.stringify(mergedRestrooms, null, 2)}\n`,
  "utf8",
);
console.log(
  `${sourceRestrooms.length}건 처리: ${addedCount}건 추가, ${updatedCount}건 갱신, 총 ${mergedRestrooms.length}건`,
);
