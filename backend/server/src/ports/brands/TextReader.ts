import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import type { TextReading } from "../../domain/brands/TextReading.js";

export interface TextReader {
  read(image: BlurredImage): Promise<TextReading>;
}
