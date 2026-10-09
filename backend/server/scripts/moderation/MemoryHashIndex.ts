import type { GeoPoint } from "../../src/domain/moderation/GeoPoint.js";
import type { PerceptualHash } from "../../src/domain/moderation/PerceptualHash.js";
import type { HashIndex, IndexedPhoto } from "../../src/ports/moderation/HashIndex.js";

// Holds the hashes of photos that passed, as the reports table does in the worker.
export class MemoryHashIndex implements HashIndex {
  readonly #photos: IndexedPhoto[] = [];

  add(photoId: string, hash: PerceptualHash, location: GeoPoint): void {
    this.#photos.push({ photoId, hash, location });
  }

  async near(): Promise<IndexedPhoto[]> {
    return [...this.#photos];
  }
}
