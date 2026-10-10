import type { FoundRegions } from "../../domain/moderation/types.js";

export interface FaceFinder {
  find(jpeg: Uint8Array): Promise<FoundRegions>;
}
