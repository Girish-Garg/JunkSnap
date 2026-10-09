import type { GeoPoint } from "../../domain/GeoPoint.js";
import type { Position, SeatGeometry } from "./SeatGeometry.js";

const EARTH_RADIUS_M = 6_371_008.8;
const RADIANS = Math.PI / 180;

export interface Span {
  readonly lat: number;
  readonly lon: number;
}

// Flat metres around one point: far under 1% off at the 1 km range of a seam check.
export class LocalPlane {
  readonly #origin: GeoPoint;
  readonly #metersPerLat: number;
  readonly #metersPerLon: number;

  constructor(origin: GeoPoint) {
    this.#origin = origin;
    this.#metersPerLat = EARTH_RADIUS_M * RADIANS;
    this.#metersPerLon = this.#metersPerLat * Math.cos(origin.lat * RADIANS);
  }

  // Degrees of latitude and longitude that cover `meters` around the origin.
  span(meters: number): Span {
    return { lat: meters / this.#metersPerLat, lon: meters / this.#metersPerLon };
  }

  distanceToEdges(geometry: SeatGeometry): number {
    const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
    let best = Infinity;
    for (const ring of rings) {
      ring.slice(1).forEach((to, index) => {
        best = Math.min(best, this.#toSegment(ring[index] ?? to, to));
      });
    }
    return best;
  }

  #toSegment(from: Position, to: Position): number {
    const [ax, ay] = this.#xy(from);
    const [bx, by] = this.#xy(to);
    const [dx, dy] = [bx - ax, by - ay];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSquared));
    return Math.hypot(ax + t * dx, ay + t * dy);
  }

  #xy([lon, lat]: Position): [number, number] {
    return [(lon - this.#origin.lon) * this.#metersPerLon, (lat - this.#origin.lat) * this.#metersPerLat];
  }
}
