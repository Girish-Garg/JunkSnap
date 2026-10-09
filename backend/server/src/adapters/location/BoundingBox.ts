import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import type { Position, SeatGeometry } from "./SeatGeometry.js";

export class BoundingBox {
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

  static around(geometry: SeatGeometry): BoundingBox {
    const positions: Position[] =
      geometry.type === "Polygon" ? geometry.coordinates.flat() : geometry.coordinates.flat(2);
    let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [lon, lat] of positions) {
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
    return new BoundingBox(west, south, east, north);
  }

  contains(point: GeoPoint): boolean {
    const { lat, lon } = point;
    return lon >= this.#west && lon <= this.#east && lat >= this.#south && lat <= this.#north;
  }
}
