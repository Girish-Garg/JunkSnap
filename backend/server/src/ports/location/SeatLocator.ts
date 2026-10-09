import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import type { AssemblySeat, LokSabhaSeat } from "../../domain/location/Seats.js";

export interface SeatLocator {
  // Provenance for location_lookup.boundaries_version.
  readonly boundariesVersion: string;
  assemblyContaining(point: GeoPoint): AssemblySeat | null;
  // Lok Sabha shapes from different sources overlap at state borders; this is the first hit.
  lokSabhaContaining(point: GeoPoint): LokSabhaSeat | null;
  nearestAssembly(point: GeoPoint, withinMeters: number): AssemblySeat | null;
  nearestLokSabha(point: GeoPoint, withinMeters: number): LokSabhaSeat | null;
  lokSabhaSeat(id: string): LokSabhaSeat | null;
}
