import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = process.argv.slice(2).find((argument) => argument !== "--");
const outputPath = path.resolve("src/data/trashBins.json");

if (!sourcePath) {
  throw new Error("병합할 휴지통 CSV 파일 경로를 입력해 주세요.");
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function createTrashBinId(trashBin) {
  const key = [
    trashBin.name,
    trashBin.coordinate.latitude,
    trashBin.coordinate.longitude,
  ].join("|");
  const digest = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return `public-trash-bin-${digest}`;
}

function createNaturalKey({ name, coordinate }) {
  return [
    name.trim(),
    coordinate.latitude.toFixed(7),
    coordinate.longitude.toFixed(7),
  ].join("|");
}

// 1. 표준 휴지통 CSV를 헤더 기반 객체로 변환한다.
// 열 순서가 바뀌어도 한글 헤더명을 기준으로 필요한 값만 안정적으로 읽기 위함이다.
const sourceText = (await readFile(path.resolve(sourcePath), "utf8")).replace(
  /^\uFEFF/,
  "",
);
const [headers, ...sourceRows] = parseCsv(sourceText);

if (!headers) {
  throw new Error("휴지통 CSV의 헤더를 찾지 못했습니다.");
}

const sourceTrashBins = sourceRows.map((values) => {
  const row = Object.fromEntries(
    headers.map((header, index) => [cleanText(header), cleanText(values[index])]),
  );
  const latitude = Number(row["위도"]);
  const longitude = Number(row["경도"]);
  const trashBin = {
    trashBinId: "",
    name: row["설치장소명"],
    city: row["시도명"],
    district: row["시군구명"],
    address: row["소재지도로명주소"] || row["소재지지번주소"],
    detail: row["세부위치"],
    trashBinType: row["휴지통종류"],
    managingOrganization: row["관리기관명"],
    coordinate: { latitude, longitude },
  };

  trashBin.trashBinId = createTrashBinId(trashBin);
  return trashBin;
});

const invalidRows = sourceTrashBins.filter(
  ({ name, coordinate }) =>
    !name ||
    !Number.isFinite(coordinate.latitude) ||
    !Number.isFinite(coordinate.longitude),
);

if (invalidRows.length > 0) {
  throw new Error(`유효하지 않은 휴지통 행이 ${invalidRows.length}건 있습니다.`);
}

// 2. 이름과 좌표가 같은 기존 행은 ID를 유지하며 갱신하고, 나머지는 신규 추가한다.
// 같은 원본을 다시 병합해도 중복 마커가 늘어나지 않는 upsert 방식이다.
const existingTrashBins = JSON.parse(await readFile(outputPath, "utf8"));
const existingByNaturalKey = new Map(
  existingTrashBins.map((trashBin) => [createNaturalKey(trashBin), trashBin]),
);
const mergedById = new Map(
  existingTrashBins.map((trashBin) => [trashBin.trashBinId, trashBin]),
);
let addedCount = 0;
let updatedCount = 0;

for (const sourceTrashBin of sourceTrashBins) {
  const existing = existingByNaturalKey.get(createNaturalKey(sourceTrashBin));
  const trashBin = existing
    ? { ...sourceTrashBin, trashBinId: existing.trashBinId }
    : sourceTrashBin;

  if (existing) {
    updatedCount += 1;
  } else {
    addedCount += 1;
  }

  mergedById.set(trashBin.trashBinId, trashBin);
}

// 3. 기존 스냅샷과 같은 좌표 순서로 저장해 변경 이력을 예측 가능하게 유지한다.
const mergedTrashBins = [...mergedById.values()].sort(
  (left, right) =>
    left.coordinate.latitude - right.coordinate.latitude ||
    left.coordinate.longitude - right.coordinate.longitude,
);

await writeFile(outputPath, JSON.stringify(mergedTrashBins), "utf8");
console.log(
  `${sourceTrashBins.length}건 처리: ${addedCount}건 추가, ${updatedCount}건 갱신, 총 ${mergedTrashBins.length}건`,
);
