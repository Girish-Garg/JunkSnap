import type { ImageScreening } from "../../domain/moderation/GatePolicy.js";

export interface ImageModerator {
  screen(jpeg: Uint8Array): Promise<ImageScreening>;
}
