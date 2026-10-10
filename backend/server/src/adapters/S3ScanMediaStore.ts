import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, NoSuchKey, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { ExternalServiceError } from "../domain/errors.js";
import { InvalidVideoError } from "../domain/scanErrors.js";
import type { DownloadedVideo, ScanMediaStore } from "../ports/ScanMediaStore.js";

// Videos and frame originals live only in the private originals bucket (SSE-KMS by bucket default).
export class S3ScanMediaStore implements ScanMediaStore {
  readonly #client: S3Client;
  readonly #bucket: string;

  constructor(client: S3Client, bucket: string) {
    this.#client = client;
    this.#bucket = bucket;
  }

  async downloadVideo(key: string, toPath: string): Promise<DownloadedVideo> {
    const body = await this.#open(key);
    const digest = createHash("sha256");
    let bytes = 0;
    await pipeline(
      body,
      async function* (chunks: AsyncIterable<Buffer>) {
        for await (const chunk of chunks) {
          digest.update(chunk);
          bytes += chunk.length;
          yield chunk;
        }
      },
      createWriteStream(toPath),
    );
    return { bytes, sha256Hex: digest.digest("hex") };
  }

  async putOriginal(key: string, jpeg: Uint8Array, sha256Hex: string): Promise<void> {
    const checksum = Buffer.from(sha256Hex, "hex").toString("base64");
    const command = new PutObjectCommand({
      Bucket: this.#bucket,
      Key: key,
      Body: jpeg,
      ContentType: "image/jpeg",
      ChecksumSHA256: checksum,
    });
    try {
      await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError(`Could not store the frame at ${key}`, { cause: error });
    }
  }

  async #open(key: string): Promise<Readable> {
    try {
      const object = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucket, Key: key }));
      if (object.Body instanceof Readable) {
        return object.Body;
      }
    } catch (error) {
      if (error instanceof NoSuchKey) {
        throw new InvalidVideoError(`No video was uploaded at ${key}`, { cause: error });
      }
      throw new ExternalServiceError(`Could not download the video at ${key}`, { cause: error });
    }
    throw new ExternalServiceError(`S3 returned no readable body for ${key}`);
  }
}
