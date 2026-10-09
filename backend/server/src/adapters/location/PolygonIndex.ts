import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import { BoundingBox } from "./BoundingBox.js";
import { LocalPlane } from "./LocalPlane.js";
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

  containing(point: GeoPoint): T | null {
    const position = point.toPosition();
    const hit = this.#entries.find(
      (entry) => entry.box.contains(point) && booleanPointInPolygon(position, entry.geometry),
    );
    return hit?.value ?? null;
  }

  // For points no shape contains: it measures to edges, so it cannot tell inside from outside.
  nearest(point: GeoPoint, maxMeters: number): T | null {
    const plane = new LocalPlane(point);
    const margin = plane.span(maxMeters);
    let [best, bestMeters]: [T | null, number] = [null, maxMeters];
    for (const entry of this.#entries) {
      const meters = entry.box.contains(point, margin) ? plane.distanceToEdges(entry.geometry) : Infinity;
      if (meters < bestMeters) {
        [best, bestMeters] = [entry.value, meters];
      }
    }
    return best;
  }
}
