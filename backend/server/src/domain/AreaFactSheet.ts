import type { GeoPoint } from "./GeoPoint.js";
import type { SensitivePlace } from "./SensitivePlace.js";

// Reviewed ward-record facts for one area; null or empty means not known, never zero.
export interface AreaFactSheet {
  readonly areaKm2: number | null;
  readonly disposalPoints: readonly GeoPoint[];
  readonly sensitivePlaces: readonly SensitivePlace[];
}
