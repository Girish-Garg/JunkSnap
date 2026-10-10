import type { BoxFraction } from './EdgeModel';

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How a frame fits the square model input: scaled so the long side fills it, centred, grey padding
 * on the short side (the Ultralytics letterbox). Maps model-pixel boxes back to frame fractions.
 */
export class Letterbox {
  readonly scaledWidth: number;
  readonly scaledHeight: number;
  readonly padX: number;
  readonly padY: number;

  private constructor(
    readonly size: number,
    scaledWidth: number,
    scaledHeight: number,
  ) {
    this.scaledWidth = scaledWidth;
    this.scaledHeight = scaledHeight;
    this.padX = Math.floor((size - scaledWidth) / 2);
    this.padY = Math.floor((size - scaledHeight) / 2);
  }

  static fit(frameWidth: number, frameHeight: number, size: number): Letterbox {
    const scale = size / Math.max(frameWidth, frameHeight, 1);
    const width = Math.max(1, Math.min(size, Math.round(frameWidth * scale)));
    const height = Math.max(1, Math.min(size, Math.round(frameHeight * scale)));
    return new Letterbox(size, width, height);
  }

  /** x1, y1, x2, y2 in model input pixels to a box in frame fractions, clipped to the frame. */
  toFraction(x1: number, y1: number, x2: number, y2: number): BoxFraction {
    const left = clamp((x1 - this.padX) / this.scaledWidth);
    const top = clamp((y1 - this.padY) / this.scaledHeight);
    const right = clamp((x2 - this.padX) / this.scaledWidth);
    const bottom = clamp((y2 - this.padY) / this.scaledHeight);
    return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  }
}
