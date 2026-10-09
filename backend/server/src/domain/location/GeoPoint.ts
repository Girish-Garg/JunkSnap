import { ValidationError } from "../errors.js";

const MAX_LAT = 90;
const MAX_LON = 180;

export class GeoPoint {
  readonly lat: number;
  readonly lon: number;

  private constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
  }

  static of(lat: number, lon: number): GeoPoint {
    if (!(Math.abs(lat) <= MAX_LAT && Math.abs(lon) <= MAX_LON)) {
      throw new ValidationError(`lat ${lat}, lon ${lon} is not a WGS 84 point`);
    }
    return new GeoPoint(lat, lon);
  }

  // GeoJSON and Amazon Location both put longitude first.
  toPosition(): [number, number] {
    return [this.lon, this.lat];
  }
}
