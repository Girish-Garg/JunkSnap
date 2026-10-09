import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { GeoPoint } from "../../domain/GeoPoint.js";
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

  // Containing shapes count as 0 m; the sort is stable, so ties keep file order.
  near(point: GeoPoint, maxMeters: number): T[] {
    const plane = new LocalPlane(point);
    const margin = plane.span(maxMeters);
    const position = [point.lon, point.lat];
    return this.#entries
      .filter((entry) => entry.box.contains(point, margin))
      .map((entry) => ({
        value: entry.value,
        meters: booleanPointInPolygon(position, entry.geometry) ? 0 : plane.distanceToEdges(entry.geometry),
      }))
      .filter(({ meters }) => meters <= maxMeters)
      .sort((left, right) => left.meters - right.meters)
      .map(({ value }) => value);
  }
}
