export interface Padding {
  readonly fraction: number;
  readonly minPixels: number;
}

// A detected box and how far past it to blur.
export interface BlurRegion {
  readonly box: Box;
  readonly padding: Padding;
}

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

  intersectionArea(other: Box): number {
    const width = Math.min(this.right, other.right) - Math.max(this.left, other.left);
    const height = Math.min(this.bottom, other.bottom) - Math.max(this.top, other.top);
    return width > 0 && height > 0 ? width * height : 0;
  }

  overlapOfSmaller(other: Box): number {
    const smaller = Math.min(this.area(), other.area());
    return smaller > 0 ? this.intersectionArea(other) / smaller : 0;
  }

  holdsCentreOf(other: Box): boolean {
    const x = other.left + other.width / 2;
    const y = other.top + other.height / 2;
    return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
  }

  // The full-width band from `from` to `to`, each a share of this box's height measured from its top.
  band(from: number, to: number): Box {
    return new Box(this.left, this.top + this.height * from, this.width, this.height * (to - from));
  }

  // True when this box starts within about one line height below `above` and shares some of its width.
  liesJustBelow(above: Box): boolean {
    const gap = this.top - above.bottom;
    const sharesWidth = this.left < above.right && this.right > above.left;
    return sharesWidth && gap >= -above.height / 2 && gap <= above.height * 1.5;
  }

  // Null when the box covers no whole pixel.
  toPixels(imageWidth: number, imageHeight: number): PixelRect | null {
    return this.toPaddedPixels({ fraction: 0, minPixels: 0 }, imageWidth, imageHeight);
  }

  // Each side moves out by half of `fraction` of the box size, and by at least minPixels; clipped to the image.
  toPaddedPixels(padding: Padding, imageWidth: number, imageHeight: number): PixelRect | null {
    const padX = Math.max(padding.minPixels, (this.width * imageWidth * padding.fraction) / 2);
    const padY = Math.max(padding.minPixels, (this.height * imageHeight * padding.fraction) / 2);
    const left = Math.max(0, Math.floor(this.left * imageWidth - padX));
    const top = Math.max(0, Math.floor(this.top * imageHeight - padY));
    const right = Math.min(imageWidth, Math.ceil(this.right * imageWidth + padX));
    const bottom = Math.min(imageHeight, Math.ceil(this.bottom * imageHeight + padY));
    if (right <= left || bottom <= top) {
      return null;
    }
    return { left, top, width: right - left, height: bottom - top };
  }
}
