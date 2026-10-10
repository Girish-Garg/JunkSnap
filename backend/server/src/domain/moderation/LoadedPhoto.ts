import type { PerceptualHash } from "./PerceptualHash.js";

export interface LoadedPhoto {
  // Auto-oriented and re-encoded without metadata, at most 5 MB: Rekognition and the blur both use these pixels.
  readonly upright: Uint8Array;
  readonly hash: PerceptualHash;
  // Mean grey level, 0 (black) to 1 (white).
  readonly brightness: number;
}

// Mean of 8-bit grey pixels, as a share of white; 0 for no pixels.
export function meanBrightness(grey: Uint8Array): number {
  let total = 0;
  for (const level of grey) {
    total += level;
  }
  return grey.length === 0 ? 0 : total / grey.length / 255;
}
