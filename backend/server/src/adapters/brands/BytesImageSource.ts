import type { Image } from "@aws-sdk/client-rekognition";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import { NotFoundError } from "../../domain/errors.js";
import type { BlurredImageStore } from "../../ports/brands/BlurredImageStore.js";
import type { RekognitionImageSource } from "./RekognitionImageSource.js";

// Dev runs and AWS tests only: JPEG bytes by report id; Rekognition takes 5 MB of bytes at most.
export class BytesImageSource implements RekognitionImageSource, BlurredImageStore {
  readonly #images: ReadonlyMap<string, Uint8Array>;

  constructor(images: ReadonlyMap<string, Uint8Array>) {
    this.#images = images;
  }

  async imageFor(image: BlurredImage): Promise<Image> {
    return { Bytes: await this.jpegBytes(image) };
  }

  async jpegBytes(image: BlurredImage): Promise<Uint8Array> {
    const bytes = this.#images.get(image.reportId);
    if (bytes === undefined) {
      throw new NotFoundError(`no image bytes for ${image.reportId}`);
    }
    return bytes;
  }
}
