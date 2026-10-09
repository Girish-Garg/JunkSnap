import type { GeoPoint } from "../../domain/location/GeoPoint.js";
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

  assemblyContaining(point: GeoPoint): AssemblySeat | null {
    return this.#assembly.containing(point);
  }

  lokSabhaContaining(point: GeoPoint): LokSabhaSeat | null {
    return this.#lokSabha.containing(point);
  }

  nearestAssembly(point: GeoPoint, withinMeters: number): AssemblySeat | null {
    return this.#assembly.nearest(point, withinMeters);
  }

  nearestLokSabha(point: GeoPoint, withinMeters: number): LokSabhaSeat | null {
    return this.#lokSabha.nearest(point, withinMeters);
  }

  lokSabhaSeat(id: string): LokSabhaSeat | null {
    return this.#lokSabhaById.get(id) ?? null;
  }
}
