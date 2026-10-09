import type { BlurredImage } from "../../domain/brands/BlurredImage.js";

export interface BlurredImageStore {
  jpegBytes(image: BlurredImage): Promise<Uint8Array>;
}
