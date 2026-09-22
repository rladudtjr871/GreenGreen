import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  throw new Error(
    "사용법: node scripts/generate-intersections-snapshot.mjs <input.csv> <output.json>",
  );
}

function decodeCsv(buffer) {
  // 1. UTF-8 BOM이 있으면 그대로 읽고, 없으면 T-Data 내려받기 파일의 CP949 인코딩으로 해석한다.
  // 원본 파일의 배포 시점에 따라 인코딩이 달라도 같은 생성 명령을 재사용하기 위한 분기다.
  const hasUtf8Bom =
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf;

  return new TextDecoder(hasUtf8Bom ? "utf-8" : "euc-kr").decode(buffer);
}

function parseDelimitedText(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let isQuoted = false;

  // 2. 따옴표 안의 구분자와 줄바꿈을 보존하며 CSV를 행과 필드로 분리한다.
  // 단순 split 사용 시 교차로명 같은 텍스트 필드가 잘못 나뉘는 일을 막는다.
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (isQuoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        isQuoted = false;
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      isQuoted = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function normalizeKoreaCoordinate(rawValue, minimum, maximum) {
  let value = Number(rawValue);
  let scale = 1;

  if (!Number.isFinite(value) || value === 0) {
    return null;
  }

  // 3. 소수점이 한두 자리 앞당겨진 배포 오류만 한국 좌표 범위까지 복원한다.
  // 범위를 벗어난 임의 값은 보정하지 않고 실패시켜 잘못된 마커가 생성되지 않게 한다.
  while (Math.abs(value) < minimum && scale < 1_000) {
    value *= 10;
    scale *= 10;
  }

  if (value < minimum || value > maximum) {
    return null;
  }

  return { value, wasCorrected: scale > 1 };
}

const inputBuffer = await readFile(resolve(inputPath));
const csvText = decodeCsv(inputBuffer).replace(/^\uFEFF/, "");
const headerLine = csvText.split(/\r?\n/, 1)[0] ?? "";
const delimiter = headerLine.includes("‡") ? "‡" : ",";
const [headers, ...sourceRows] = parseDelimitedText(csvText, delimiter);
const headerIndexes = new Map(headers.map((header, index) => [header.trim(), index]));

const fieldNames = {
  id: headerIndexes.has("ITST_ID") ? "ITST_ID" : "itstId",
  name: headerIndexes.has("ITST_NM") ? "ITST_NM" : "itstNm",
  latitude: headerIndexes.has("MAP_CTPT_INT_LAT")
    ? "MAP_CTPT_INT_LAT"
    : "mapCtptIntLat",
  longitude: headerIndexes.has("MAP_CTPT_INT_LOT")
    ? "MAP_CTPT_INT_LOT"
    : "mapCtptIntLot",
};

Object.values(fieldNames).forEach((fieldName) => {
  if (!headerIndexes.has(fieldName)) {
    throw new Error(`필수 CSV 컬럼이 없습니다: ${fieldName}`);
  }
});

const records = [];
const intersectionIds = new Set();
let correctedCoordinateCount = 0;

// 4. 지도와 신호 API가 함께 사용하는 네 필드만 안정적인 스냅샷 형식으로 추출한다.
// 불필요한 외부 필드를 제거해 UI와 원본 CSV 스키마의 결합을 최소화한다.
sourceRows.forEach((row, rowIndex) => {
  if (row.length === 1 && row[0].trim() === "") {
    return;
  }

  const readField = (fieldName) =>
    String(row[headerIndexes.get(fieldName)] ?? "").trim();
  const intersectionId = readField(fieldNames.id);
  const name = readField(fieldNames.name);
  const latitude = normalizeKoreaCoordinate(
    readField(fieldNames.latitude),
    33,
    39,
  );
  const longitude = normalizeKoreaCoordinate(
    readField(fieldNames.longitude),
    124,
    132,
  );

  if (!intersectionId || !latitude || !longitude) {
    throw new Error(`${rowIndex + 2}행의 ID 또는 좌표가 올바르지 않습니다.`);
  }

  if (intersectionIds.has(intersectionId)) {
    throw new Error(`중복 교차로 ID가 있습니다: ${intersectionId}`);
  }

  intersectionIds.add(intersectionId);
  correctedCoordinateCount += Number(
    latitude.wasCorrected || longitude.wasCorrected,
  );
  records.push({
    itstId: intersectionId,
    itstNm: name,
    mapCtptIntLat: latitude.value,
    mapCtptIntLot: longitude.value,
  });
});

await writeFile(resolve(outputPath), `${JSON.stringify(records)}\n`, "utf8");

console.log(
  JSON.stringify({
    inputRows: sourceRows.length,
    outputRows: records.length,
    correctedCoordinateRows: correctedCoordinateCount,
    outputPath: resolve(outputPath),
  }),
);
