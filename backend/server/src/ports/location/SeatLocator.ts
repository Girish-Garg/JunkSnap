import type { GeoPoint } from "../../domain/GeoPoint.js";
import type { AssemblySeat, LokSabhaSeat } from "../../domain/location/Seats.js";

// The *Near methods list seats nearest first: those containing the point (0 m, in file order), then by edge distance.
export interface SeatLocator {
  // Provenance for location_lookup.boundaries_version.
  readonly boundariesVersion: string;
  assemblySeatsNear(point: GeoPoint, withinMeters: number): AssemblySeat[];
  lokSabhaSeatsNear(point: GeoPoint, withinMeters: number): LokSabhaSeat[];
  lokSabhaSeat(id: string): LokSabhaSeat | null;
}
