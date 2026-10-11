import { ValidationError } from "../errors.js";
import type { GeoPoint } from "./GeoPoint.js";
import { BboxTooLargeError } from "./SiteErrors.js";

const SPAN_TOLERANCE = 1e-9;
const METRES_PER_DEGREE_LAT = 111_320;
const MIN_COS_LAT = 0.01;
const BBOX_SHAPE = "bbox must be minLon,minLat,maxLon,maxLat";

export class BoundingBox {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;

  private constructor(minLon: number, minLat: number, maxLon: number, maxLat: number) {
    this.minLon = minLon;
    this.minLat = minLat;
    this.maxLon = maxLon;
    this.maxLat = maxLat;
  }

  // The GET /sites query value: four numbers, corners in range, at most maxSpanDeg (BBOX_MAX_DEGREES) on each side.
  static parse(text: string, maxSpanDeg: number): BoundingBox {
    const numbers = text.split(",").map((part) => (part.trim() === "" ? Number.NaN : Number(part)));
    if (numbers.length !== 4 || !numbers.every(Number.isFinite)) {
      throw new ValidationError(BBOX_SHAPE);
    }
    const [minLon, minLat, maxLon, maxLat] = numbers as [number, number, number, number];
    const box = new BoundingBox(minLon, minLat, maxLon, maxLat);
    if (!box.#cornersValid()) {
      throw new ValidationError(`${BBOX_SHAPE}, inside -180..180 and -90..90, min before max`);
    }
    if (box.#tooLarge(maxSpanDeg)) {
      throw new BboxTooLargeError(`bbox can cover at most ${maxSpanDeg} by ${maxSpanDeg} degree`);
    }
    return box;
  }

  static around(centre: GeoPoint, metres: number): BoundingBox {
    const dLat = metres / METRES_PER_DEGREE_LAT;
    const dLon = dLat / Math.max(Math.cos((centre.lat * Math.PI) / 180), MIN_COS_LAT);
    return new BoundingBox(centre.lon - dLon, centre.lat - dLat, centre.lon + dLon, centre.lat + dLat);
  }

  contains(point: GeoPoint): boolean {
    const insideLon = point.lon >= this.minLon && point.lon <= this.maxLon;
    return insideLon && point.lat >= this.minLat && point.lat <= this.maxLat;
  }

  #cornersValid(): boolean {
    const lonOk = this.minLon >= -180 && this.maxLon <= 180 && this.minLon <= this.maxLon;
    return lonOk && this.minLat >= -90 && this.maxLat <= 90 && this.minLat <= this.maxLat;
  }

  #tooLarge(maxSpanDeg: number): boolean {
    const limit = maxSpanDeg + SPAN_TOLERANCE;
    return this.maxLon - this.minLon > limit || this.maxLat - this.minLat > limit;
  }
}
