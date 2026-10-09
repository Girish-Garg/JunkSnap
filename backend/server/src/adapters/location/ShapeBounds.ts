import type { GeoPoint } from "../../domain/GeoPoint.js";
import type { Span } from "./LocalPlane.js";
import type { Position, SeatGeometry } from "./SeatGeometry.js";

const NO_MARGIN: Span = { lat: 0, lon: 0 };

export class ShapeBounds {
  readonly #west: number;
  readonly #south: number;
  readonly #east: number;
  readonly #north: number;

  private constructor(west: number, south: number, east: number, north: number) {
    this.#west = west;
    this.#south = south;
    this.#east = east;
    this.#north = north;
  }

  static around(geometry: SeatGeometry): ShapeBounds {
    const positions: Position[] =
      geometry.type === "Polygon" ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
    let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [lon, lat] of positions) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    return new ShapeBounds(west, south, east, north);
  }

  contains(point: GeoPoint, margin: Span = NO_MARGIN): boolean {
    const { lat, lon } = point;
    const withinLon = lon >= this.#west - margin.lon && lon <= this.#east + margin.lon;
    return withinLon && lat >= this.#south - margin.lat && lat <= this.#north + margin.lat;
  }
}
