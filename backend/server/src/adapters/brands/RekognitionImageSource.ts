import type { Image } from "@aws-sdk/client-rekognition";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";

// Where Rekognition reads the blurred photo from: the public bucket in the service, local bytes in dev runs.
export interface RekognitionImageSource {
  imageFor(image: BlurredImage): Promise<Image>;
}
