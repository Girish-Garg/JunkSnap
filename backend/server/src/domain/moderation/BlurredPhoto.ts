import type { BlurRecord } from "./BlurRecord.js";

// The public copy before it is written; only blurred bytes go to any model.
export interface BlurredPhoto {
  readonly jpeg: Uint8Array;
  readonly record: BlurRecord;
}
