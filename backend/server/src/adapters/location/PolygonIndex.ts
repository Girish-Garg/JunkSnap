import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import { BoundingBox } from "./BoundingBox.js";
import type { SeatGeometry, Shape } from "./SeatGeometry.js";

interface Entry<T> {
  readonly box: BoundingBox;
  readonly geometry: SeatGeometry;
  readonly value: T;
}

// Built once per process; a lookup tests the cheap bounding box before the exact polygon.
export class PolygonIndex<T> {
  readonly #entries: readonly Entry<T>[];

  constructor(shapes: readonly Shape<T>[]) {
    this.#entries = shapes.map(({ geometry, value }) => ({ box: BoundingBox.around(geometry), geometry, value }));
  }

  find(point: GeoPoint): T | null {
    const position = point.toPosition();
    const hit = this.#entries.find(
      (entry) => entry.box.contains(point) && booleanPointInPolygon(position, entry.geometry),
    );
    return hit?.value ?? null;
  }
}
