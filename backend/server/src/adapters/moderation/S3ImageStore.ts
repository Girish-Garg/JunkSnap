import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { ExternalServiceError } from "../../domain/errors.js";
import type { ImageStore } from "../../ports/moderation/ImageStore.js";
import { callService } from "./utils.js";

export interface ImageBuckets {
  readonly originals: string;
  readonly public: string;
}

const PUBLIC_CACHE = "public, max-age=86400";

export class S3ImageStore implements ImageStore {
  readonly #client: S3Client;
  readonly #buckets: ImageBuckets;

  constructor(client: S3Client, buckets: ImageBuckets) {
    this.#client = client;
    this.#buckets = buckets;
  }

  // Asks for one byte more than the limit, so an oversized upload is never downloaded whole.
  async readOriginal(key: string, maxBytes: number): Promise<Uint8Array | null> {
    const bytes = await callService("S3 GetObject", () => this.#firstBytes(key, maxBytes + 1));
    return bytes.byteLength > maxBytes ? null : bytes;
  }

  async #firstBytes(key: string, count: number): Promise<Uint8Array> {
    const command = new GetObjectCommand({ Bucket: this.#buckets.originals, Key: key, Range: `bytes=0-${count - 1}` });
    try {
      const response = await this.#client.send(command);
      if (response.Body === undefined) {
        throw new ExternalServiceError(`S3 object ${key} has no body`);
      }
      return await response.Body.transformToByteArray();
    } catch (error) {
      // An empty object has no byte 0, so S3 answers the ranged GET with InvalidRange; the loader rejects it as not a JPEG.
      if (error instanceof Error && error.name === "InvalidRange") {
        return new Uint8Array();
      }
      throw error;
    }
  }

  async writePublic(key: string, jpeg: Uint8Array): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.#buckets.public,
      Key: key,
      Body: jpeg,
      ContentType: "image/jpeg",
      CacheControl: PUBLIC_CACHE,
    });
    await callService("S3 PutObject", () => this.#client.send(command));
  }
}
