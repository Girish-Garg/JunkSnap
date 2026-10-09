import sharp from "sharp";
import { FrameHash } from "../domain/FrameHash.js";
import type { FrameHasher } from "../ports/FrameHasher.js";

const COLUMNS = 9;
const ROWS = 8;

// Difference hash: shrink to 9x8 grey, then one bit per pixel that is brighter than its right neighbour.
export class SharpFrameHasher implements FrameHasher {
  async hash(jpegPath: string): Promise<FrameHash> {
    const pixels = await sharp(jpegPath).greyscale().resize(COLUMNS, ROWS, { fit: "fill" }).raw().toBuffer();
    let bits = 0n;
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS - 1; column += 1) {
        const index = row * COLUMNS + column;
        const brighter = (pixels[index] ?? 0) > (pixels[index + 1] ?? 0);
        bits = (bits << 1n) | (brighter ? 1n : 0n);
      }
    }
    return new FrameHash(bits);
  }
}
