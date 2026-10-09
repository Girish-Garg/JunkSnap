import type { Image } from "@aws-sdk/client-rekognition";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import { NotFoundError } from "../../domain/errors.js";
import type { RekognitionImageSource } from "./RekognitionImageSource.js";

// Dev runs and AWS tests only: JPEG bytes by report id; Rekognition takes 5 MB of bytes at most.
export class BytesImageSource implements RekognitionImageSource {
  readonly #images: ReadonlyMap<string, Uint8Array>;

  constructor(images: ReadonlyMap<string, Uint8Array>) {
    this.#images = images;
  }

  async imageFor(image: BlurredImage): Promise<Image> {
    const bytes = this.#images.get(image.reportId);
    if (bytes === undefined) {
      throw new NotFoundError(`no image bytes for ${image.reportId}`);
    }
    return { Bytes: bytes };
  }
}
