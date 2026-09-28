import type { MapCoordinate } from "@/types/map";

export type Restroom = {
  restroomId: string;
  name: string;
  district: string;
  roadAddress: string;
  lotAddress: string;
  restroomType: string;
  openingHours: string;
  availability: string;
  accessibleAvailability: string;
  locationCategory: string;
  closedDays: string;
  facilities: string;
  safetyFacilities: string;
  telephone: string;
  note: string;
  coordinate: MapCoordinate;
};
