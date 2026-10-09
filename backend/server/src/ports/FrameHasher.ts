import type { FrameHash } from "../domain/FrameHash.js";

export interface FrameHasher {
  hash(jpegPath: string): Promise<FrameHash>;
}
