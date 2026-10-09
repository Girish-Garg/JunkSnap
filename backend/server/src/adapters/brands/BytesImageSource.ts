import type { Image } from "@aws-sdk/client-rekognition";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import { NotFoundError } from "../../domain/errors.js";
import type { RekognitionImageSource } from "./RekognitionImageSource.js";

// Dev runs and AWS tests: JPEG bytes by report id, already blurred or free of people; 5 MB at most.
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
