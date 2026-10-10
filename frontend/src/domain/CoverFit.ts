import type { BoxFraction } from './EdgeModel';

/** A box in percent of the on-screen viewfinder, ready for left/top/width/height styles. */
export interface ScreenBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where the frame lands in a box shown with object-fit: cover: scaled until it covers the element,
 * centred, the overflow cropped. Maps frame-fraction boxes to element percentages.
 */
export class CoverFit {
  readonly #shownWidth: number;
  readonly #shownHeight: number;
  readonly #offsetX: number;
  readonly #offsetY: number;

  constructor(frame: { readonly width: number; readonly height: number }, element: { readonly width: number; readonly height: number }) {
    const scale = Math.max(element.width / Math.max(frame.width, 1), element.height / Math.max(frame.height, 1));
    // Shown size and crop offset, both in element fractions.
    this.#shownWidth = (frame.width * scale) / Math.max(element.width, 1);
    this.#shownHeight = (frame.height * scale) / Math.max(element.height, 1);
    this.#offsetX = (1 - this.#shownWidth) / 2;
    this.#offsetY = (1 - this.#shownHeight) / 2;
  }

  /** The box in element percent, clipped to the element; null when it falls outside the visible crop. */
  place(box: BoxFraction): ScreenBox | null {
    const left = Math.max(0, this.#offsetX + box.left * this.#shownWidth);
    const top = Math.max(0, this.#offsetY + box.top * this.#shownHeight);
    const right = Math.min(1, this.#offsetX + (box.left + box.width) * this.#shownWidth);
    const bottom = Math.min(1, this.#offsetY + (box.top + box.height) * this.#shownHeight);
    if (right - left <= 0.005 || bottom - top <= 0.005) return null;
    const percent = (value: number) => Math.round(value * 10_000) / 100;
    return { left: percent(left), top: percent(top), width: percent(right - left), height: percent(bottom - top) };
  }
}
