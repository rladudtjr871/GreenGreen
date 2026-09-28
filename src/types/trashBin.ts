import type { MapCoordinate } from "@/types/map";

export type TrashBinDataVersion = "v1" | "v2";

export type TrashBin = {
  /** 원본 행의 위치와 분류를 기반으로 만든 안정적인 식별자다. */
  trashBinId: string;
  /** 공공데이터에 등록된 설치 장소 이름이다. */
  name: string;
  city: string;
  district: string;
  address: string;
  detail: string;
  trashBinType: string;
  managingOrganization: string;
  coordinate: MapCoordinate;
};
