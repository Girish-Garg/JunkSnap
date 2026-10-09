export interface PixelRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

// Rekognition-style box: every field is a fraction of the image's width or height.
export class Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;

  constructor(left: number, top: number, width: number, height: number) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }

  static enclosing(boxes: readonly Box[]): Box {
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    return new Box(left, top, right - left, bottom - top);
  }

  // Keeps the first of any boxes that cover the same region.
  static distinct(boxes: readonly Box[]): Box[] {
    const kept: Box[] = [];
    for (const box of boxes) {
      if (!kept.some((other) => other.overlapOfSmaller(box) >= 0.5)) {
        kept.push(box);
      }
    }
    return kept;
  }

  get right(): number {
    return this.left + this.width;
  }

  get bottom(): number {
    return this.top + this.height;
  }

  area(): number {
    return Math.max(0, this.width) * Math.max(0, this.height);
  }

  // Grows width and height by `fraction` around the centre, clipped to the image.
  grow(fraction: number): Box {
    const dx = (this.width * fraction) / 2;
    const dy = (this.height * fraction) / 2;
    const left = Math.max(0, this.left - dx);
    const top = Math.max(0, this.top - dy);
    return new Box(left, top, Math.min(1, this.right + dx) - left, Math.min(1, this.bottom + dy) - top);
  }

  intersectionArea(other: Box): number {
    const width = Math.min(this.right, other.right) - Math.max(this.left, other.left);
    const height = Math.min(this.bottom, other.bottom) - Math.max(this.top, other.top);
    return width > 0 && height > 0 ? width * height : 0;
  }

  overlapOfSmaller(other: Box): number {
    const smaller = Math.min(this.area(), other.area());
    return smaller > 0 ? this.intersectionArea(other) / smaller : 0;
  }

  // True when this box starts within about one line height below `above` and shares some of its width.
  liesJustBelow(above: Box): boolean {
    const gap = this.top - above.bottom;
    const sharesWidth = this.left < above.right && this.right > above.left;
    return sharesWidth && gap >= -above.height / 2 && gap <= above.height * 1.5;
  }

  // Null when the box covers no whole pixel.
  toPixels(imageWidth: number, imageHeight: number): PixelRect | null {
    const left = Math.max(0, Math.floor(this.left * imageWidth));
    const top = Math.max(0, Math.floor(this.top * imageHeight));
    const right = Math.min(imageWidth, Math.ceil(this.right * imageWidth));
    const bottom = Math.min(imageHeight, Math.ceil(this.bottom * imageHeight));
    if (right <= left || bottom <= top) {
      return null;
    }
    return { left, top, width: right - left, height: bottom - top };
  }
}
