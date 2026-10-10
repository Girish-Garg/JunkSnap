import type { PerceptualHash } from "./PerceptualHash.js";

export interface LoadedPhoto {
  // Auto-oriented and re-encoded without metadata, at most 5 MB: Rekognition and the blur both use these pixels.
  readonly upright: Uint8Array;
  readonly hash: PerceptualHash;
}
