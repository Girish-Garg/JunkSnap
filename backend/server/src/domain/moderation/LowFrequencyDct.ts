import { at } from "./utils.js";

const SIDE = 32;
const LOW = 8;

// Separable 2-D DCT-II of a SIDE x SIDE image, keeping the LOW x LOW lowest frequencies.
export class LowFrequencyDct {
  // cos((2i + 1) u pi / 2N) for the LOW lowest frequencies u, indexed [u * SIDE + i].
  readonly #cosines = Float64Array.from({ length: LOW * SIDE }, (_value, index) => {
    const u = Math.floor(index / SIDE);
    return Math.cos(((2 * (index % SIDE) + 1) * u * Math.PI) / (2 * SIDE));
  });

  terms(pixels: Uint8Array): number[] {
    const rows = Float64Array.from({ length: SIDE * LOW }, (_value, index) => {
      const y = Math.floor(index / LOW);
      return this.#term((x) => at(pixels, y * SIDE + x), index % LOW);
    });
    return Array.from({ length: LOW * LOW }, (_value, index) => {
      const u = index % LOW;
      return this.#term((y) => at(rows, y * LOW + u), Math.floor(index / LOW));
    });
  }

  #term(sample: (i: number) => number, u: number): number {
    let sum = 0;
    for (let i = 0; i < SIDE; i += 1) {
      sum += sample(i) * at(this.#cosines, u * SIDE + i);
    }
    return sum;
  }
}
