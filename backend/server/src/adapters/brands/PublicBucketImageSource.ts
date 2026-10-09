import type { Image } from "@aws-sdk/client-rekognition";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import type { RekognitionImageSource } from "./RekognitionImageSource.js";

// Never the originals bucket: only blurred copies go to any model.
export class PublicBucketImageSource implements RekognitionImageSource {
  readonly #bucket: string;

  constructor(publicBucket: string) {
    this.#bucket = publicBucket;
  }

  async imageFor(image: BlurredImage): Promise<Image> {
    return { S3Object: { Bucket: this.#bucket, Name: image.key } };
  }
}
