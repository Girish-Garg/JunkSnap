import { GetObjectCommand, type GetObjectCommandOutput } from "@aws-sdk/client-s3";
import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import { ExternalServiceError } from "../../domain/errors.js";
import type { BlurredImageStore } from "../../ports/brands/BlurredImageStore.js";

export interface GetObjectClient {
  send(command: GetObjectCommand): Promise<GetObjectCommandOutput>;
}

// Reads only the public bucket, so only blurred copies can reach the LLM.
export class S3BlurredImageStore implements BlurredImageStore {
  readonly #client: GetObjectClient;
  readonly #bucket: string;

  constructor(client: GetObjectClient, publicBucket: string) {
    this.#client = client;
    this.#bucket = publicBucket;
  }

  async jpegBytes(image: BlurredImage): Promise<Uint8Array> {
    try {
      const output = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucket, Key: image.key }));
      if (output.Body === undefined) {
        throw new ExternalServiceError(`S3 returned no body for ${image.key}`);
      }
      return await output.Body.transformToByteArray();
    } catch (error) {
      throw error instanceof ExternalServiceError ? error : new ExternalServiceError(`S3 read of ${image.key} failed`, { cause: error });
    }
  }
}
