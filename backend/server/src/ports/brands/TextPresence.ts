import type { BlurredImage } from "../../domain/brands/BlurredImage.js";

// Whether the image shows text in any script; the OCR reads Latin script only.
export interface TextPresence {
  hasText(image: BlurredImage): Promise<boolean>;
}
