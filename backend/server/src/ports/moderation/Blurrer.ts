import type { BlurRegion } from "../../domain/moderation/Box.js";

export interface Blurrer {
  // A new JPEG, auto-oriented and without metadata, in which every padded region is unreadable.
  obscure(jpeg: Uint8Array, regions: readonly BlurRegion[]): Promise<Uint8Array>;
}
