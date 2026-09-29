import type { MapCoordinate } from "@/types/map";

export type Restroom = {
  restroomId: string;
  name: string;
  district: string | null;
  roadAddress: string | null;
  lotAddress: string | null;
  restroomType: string | null;
  openingHours: string | null;
  availability: string | null;
  accessibleAvailability: string | null;
  locationCategory: string | null;
  closedDays: string | null;
  facilities: string | null;
  safetyFacilities: string | null;
  telephone: string | null;
  note: string | null;
  coordinate: MapCoordinate;
};
