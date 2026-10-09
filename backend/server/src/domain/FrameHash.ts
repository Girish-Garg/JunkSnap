const HASH_BITS = 64;

// 64-bit difference hash of a frame; near-identical views differ in only a few bits.
export class FrameHash {
  readonly #bits: bigint;

  constructor(bits: bigint) {
    this.#bits = BigInt.asUintN(HASH_BITS, bits);
  }

  distanceTo(other: FrameHash): number {
    let rest = this.#bits ^ other.#bits;
    let count = 0;
    while (rest > 0n) {
      count += Number(rest & 1n);
      rest >>= 1n;
    }
    return count;
  }

  toHex(): string {
    return this.#bits.toString(16).padStart(HASH_BITS / 4, "0");
  }
}
