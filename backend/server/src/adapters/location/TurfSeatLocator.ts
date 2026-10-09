import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import type { AreaRef, LokSabhaSeat } from "../../domain/location/Seats.js";
import type { SeatLocator } from "../../ports/location/SeatLocator.js";
import { PolygonIndex } from "./PolygonIndex.js";
import type { Shape } from "./SeatGeometry.js";

export interface SeatBoundaries {
  readonly version: string;
  readonly assembly: readonly Shape<AreaRef>[];
  readonly lokSabha: readonly Shape<LokSabhaSeat>[];
}

export class TurfSeatLocator implements SeatLocator {
  readonly boundariesVersion: string;
  readonly #assembly: PolygonIndex<AreaRef>;
  readonly #lokSabha: PolygonIndex<LokSabhaSeat>;

  constructor(boundaries: SeatBoundaries) {
    this.boundariesVersion = boundaries.version;
    this.#assembly = new PolygonIndex(boundaries.assembly);
    this.#lokSabha = new PolygonIndex(boundaries.lokSabha);
  }

  assemblySeatAt(point: GeoPoint): AreaRef | null {
    return this.#assembly.find(point);
  }

  lokSabhaSeatAt(point: GeoPoint): LokSabhaSeat | null {
    return this.#lokSabha.find(point);
  }
}
