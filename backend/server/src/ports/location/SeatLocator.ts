import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import type { AreaRef, LokSabhaSeat } from "../../domain/location/Seats.js";

export interface SeatLocator {
  // Provenance for location_lookup.boundaries_version.
  readonly boundariesVersion: string;
  assemblySeatAt(point: GeoPoint): AreaRef | null;
  lokSabhaSeatAt(point: GeoPoint): LokSabhaSeat | null;
}
