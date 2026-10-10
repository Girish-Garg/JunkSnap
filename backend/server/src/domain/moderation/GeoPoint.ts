import { radians } from "./utils.js";

const EARTH_RADIUS_M = 6_371_000;

export class GeoPoint {
  readonly lat: number;
  readonly lon: number;

  constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
  }

  // Haversine distance in metres.
  distanceTo(other: GeoPoint): number {
    const dLat = radians(other.lat - this.lat);
    const dLon = radians(other.lon - this.lon);
    const a =
      Math.sin(dLat / 2) ** 2 + Math.cos(radians(this.lat)) * Math.cos(radians(other.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }
}
