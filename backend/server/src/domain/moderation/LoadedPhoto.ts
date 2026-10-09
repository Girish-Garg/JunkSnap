import type { PerceptualHash } from "./PerceptualHash.js";

export interface LoadedPhoto {
  readonly original: Uint8Array;
  // At most 5 MB, which Rekognition accepts; the original itself when it is small enough.
  readonly detectorCopy: Uint8Array;
  readonly hash: PerceptualHash;
}
