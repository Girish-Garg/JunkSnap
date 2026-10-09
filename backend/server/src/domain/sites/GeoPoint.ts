const EARTH_RADIUS_M = 6_371_008.8;
const RADIANS_PER_DEGREE = Math.PI / 180;

export class GeoPoint {
  readonly lat: number;
  readonly lon: number;

  constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
  }

  // Haversine great-circle distance, in metres.
  distanceTo(other: GeoPoint): number {
    const dLat = (other.lat - this.lat) * RADIANS_PER_DEGREE;
    const dLon = (other.lon - this.lon) * RADIANS_PER_DEGREE;
    const cosines = Math.cos(this.lat * RADIANS_PER_DEGREE) * Math.cos(other.lat * RADIANS_PER_DEGREE);
    const a = Math.sin(dLat / 2) ** 2 + cosines * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // GeoJSON order.
  coordinates(): [number, number] {
    return [this.lon, this.lat];
  }
}
