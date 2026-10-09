import type { Box } from "../../domain/moderation/Box.js";

export interface Blurrer {
  // A new JPEG, auto-oriented and without metadata, in which every box is unreadable.
  obscure(jpeg: Uint8Array, boxes: readonly Box[]): Promise<Uint8Array>;
}
