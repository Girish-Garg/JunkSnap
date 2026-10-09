import type { GeoPoint } from "../../domain/GeoPoint.js";
import type { AssemblySeat, LokSabhaSeat } from "../../domain/location/Seats.js";
import type { SeatLocator } from "../../ports/location/SeatLocator.js";
import { PolygonIndex } from "./PolygonIndex.js";
import type { Shape } from "./SeatGeometry.js";

export interface SeatBoundaries {
  readonly version: string;
  readonly assembly: readonly Shape<AssemblySeat>[];
  readonly lokSabha: readonly Shape<LokSabhaSeat>[];
}

export class TurfSeatLocator implements SeatLocator {
  readonly boundariesVersion: string;
  readonly #assembly: PolygonIndex<AssemblySeat>;
  readonly #lokSabha: PolygonIndex<LokSabhaSeat>;
  readonly #lokSabhaById: ReadonlyMap<string, LokSabhaSeat>;

  constructor(boundaries: SeatBoundaries) {
    this.boundariesVersion = boundaries.version;
    this.#assembly = new PolygonIndex(boundaries.assembly);
    this.#lokSabha = new PolygonIndex(boundaries.lokSabha);
    this.#lokSabhaById = new Map(boundaries.lokSabha.map(({ value }) => [value.id, value]));
  }

  assemblySeatsNear(point: GeoPoint, withinMeters: number): AssemblySeat[] {
    return this.#assembly.near(point, withinMeters);
  }

  lokSabhaSeatsNear(point: GeoPoint, withinMeters: number): LokSabhaSeat[] {
    return this.#lokSabha.near(point, withinMeters);
  }

  lokSabhaSeat(id: string): LokSabhaSeat | null {
    return this.#lokSabhaById.get(id) ?? null;
  }
}
