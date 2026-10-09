import type { BrandLabel } from "../../contracts/index.gen.js";

export interface BoxFields {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

// Fractions of image width and height, clamped so the box never leaves the image.
export class Box implements BoxFields {
  static readonly WHOLE_IMAGE = new Box({ left: 0, top: 0, width: 1, height: 1 });

  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;

  constructor(fields: BoxFields) {
    this.left = Box.#clamp(fields.left, 1);
    this.top = Box.#clamp(fields.top, 1);
    this.width = Box.#clamp(fields.width, 1 - this.left);
    this.height = Box.#clamp(fields.height, 1 - this.top);
  }

  static union(boxes: readonly Box[]): Box {
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.left + box.width));
    const bottom = Math.max(...boxes.map((box) => box.top + box.height));
    return new Box({ left, top, width: right - left, height: bottom - top });
  }

  toContract(): BrandLabel["box"] {
    const round = (value: number): number => Math.round(value * 10_000) / 10_000;
    return { left: round(this.left), top: round(this.top), width: round(this.width), height: round(this.height) };
  }

  static #clamp(value: number, max: number): number {
    return Math.min(Math.max(value, 0), max);
  }
}
