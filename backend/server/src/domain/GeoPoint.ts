const EARTH_RADIUS_M = 6_371_000;
const RADIANS = Math.PI / 180;

export class GeoPoint {
  readonly lat: number;
  readonly lon: number;

  constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
  }

  // Haversine great-circle distance in metres.
  distanceTo(other: GeoPoint): number {
    const dLat = (other.lat - this.lat) * RADIANS;
    const dLon = (other.lon - this.lon) * RADIANS;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.lat * RADIANS) * Math.cos(other.lat * RADIANS) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }
}
