import type { LonLat } from './Site';

export class BBox {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;

  constructor(minLon: number, minLat: number, maxLon: number, maxLat: number) {
    this.minLon = minLon;
    this.minLat = minLat;
    this.maxLon = maxLon;
    this.maxLat = maxLat;
  }

  static around([lon, lat]: LonLat, span: number): BBox {
    const half = span / 2;
    return new BBox(lon - half, lat - half, lon + half, lat + half);
  }

  center(): LonLat {
    return [(this.minLon + this.maxLon) / 2, (this.minLat + this.maxLat) / 2];
  }

  contains([lon, lat]: LonLat): boolean {
    return lon >= this.minLon && lon <= this.maxLon && lat >= this.minLat && lat <= this.maxLat;
  }

  isWiderThan(span: number): boolean {
    return this.maxLon - this.minLon > span || this.maxLat - this.minLat > span;
  }

  /** maxSpan is in degrees. */
  clampedTo(maxSpan: number): BBox {
    const [lon, lat] = this.center();
    const halfLon = Math.min(this.maxLon - this.minLon, maxSpan) / 2;
    const halfLat = Math.min(this.maxLat - this.minLat, maxSpan) / 2;
    return new BBox(lon - halfLon, lat - halfLat, lon + halfLon, lat + halfLat);
  }

  /** Equal tiles, none wider or taller than maxSpan degrees, covering this box row by row. */
  split(maxSpan: number): readonly BBox[] {
    const cols = BBox.#parts(this.maxLon - this.minLon, maxSpan);
    const rows = BBox.#parts(this.maxLat - this.minLat, maxSpan);
    const width = (this.maxLon - this.minLon) / cols;
    const height = (this.maxLat - this.minLat) / rows;
    return Array.from({ length: rows * cols }, (_, index) => {
      const lon = this.minLon + (index % cols) * width;
      const lat = this.minLat + Math.floor(index / cols) * height;
      return new BBox(lon, lat, lon + width, lat + height);
    });
  }

  // The epsilon keeps 2.97 / 0.99 at 3 parts despite floating point.
  static #parts(length: number, maxSpan: number): number {
    return Math.max(1, Math.ceil(length / maxSpan - 1e-9));
  }

  toQuery(): string {
    return [this.minLon, this.minLat, this.maxLon, this.maxLat].map((n) => n.toFixed(5)).join(',');
  }
}
