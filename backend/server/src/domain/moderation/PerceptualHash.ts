import { InternalDataError } from "../errors.js";
import { LowFrequencyDct } from "./LowFrequencyDct.js";
import { median } from "./utils.js";

const SIDE = 32;
const HEX = /^[0-9a-f]{16}$/;

// 64-bit DCT perceptual hash: a bit is set where a low frequency beats the median of the non-DC terms.
export class PerceptualHash {
  static readonly SIDE = SIDE;
  static readonly #dct = new LowFrequencyDct();
  readonly #bits: bigint;

  private constructor(bits: bigint) {
    this.#bits = bits;
  }

  // Grayscale pixels, SIDE x SIDE, row-major.
  static fromGrayscale(pixels: Uint8Array): PerceptualHash {
    if (pixels.length !== SIDE * SIDE) {
      throw new InternalDataError(`pHash needs ${SIDE * SIDE} pixels, got ${pixels.length}`);
    }
    const terms = PerceptualHash.#dct.terms(pixels);
    const threshold = median(terms.slice(1));
    const bits = terms.reduce((acc, term) => (acc << 1n) | (term > threshold ? 1n : 0n), 0n);
    return new PerceptualHash(bits);
  }

  static fromHex(hex: string): PerceptualHash {
    if (!HEX.test(hex)) {
      throw new InternalDataError(`bad pHash: ${hex}`);
    }
    return new PerceptualHash(BigInt(`0x${hex}`));
  }

  toHex(): string {
    return this.#bits.toString(16).padStart(16, "0");
  }

  distanceTo(other: PerceptualHash): number {
    let diff = this.#bits ^ other.#bits;
    let count = 0;
    while (diff > 0n) {
      count += Number(diff & 1n);
      diff >>= 1n;
    }
    return count;
  }
}
