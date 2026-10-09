import type { FoundRegions } from "../../domain/moderation/types.js";

export interface PlateFinder {
  find(jpeg: Uint8Array): Promise<FoundRegions>;
}
