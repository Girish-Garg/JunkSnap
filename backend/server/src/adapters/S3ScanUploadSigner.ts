import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ExternalServiceError } from "../domain/errors.js";
import type { ScanUploadSigner, SignedUpload, VideoUpload } from "../ports/ScanUploadSigner.js";

// Content type and length are signed too, so S3 refuses other bytes, another type or a bigger file.
const SIGNED_HEADERS = new Set(["content-type", "content-length"]);
const HEADERS_KEPT_OUT_OF_QUERY = new Set(["x-amz-checksum-sha256"]);

export class S3ScanUploadSigner implements ScanUploadSigner {
  readonly #client: S3Client;
  readonly #bucket: string;
  readonly #ttlSeconds: number;

  constructor(client: S3Client, bucket: string, ttlSeconds: number) {
    this.#client = client;
    this.#bucket = bucket;
    this.#ttlSeconds = ttlSeconds;
  }

  async sign(upload: VideoUpload): Promise<SignedUpload> {
    const checksum = Buffer.from(upload.sha256Hex, "hex").toString("base64");
    const command = new PutObjectCommand({
      Bucket: this.#bucket,
      Key: upload.key,
      ContentType: upload.contentType,
      ContentLength: upload.sizeBytes,
      ChecksumSHA256: checksum,
    });
    const options = {
      expiresIn: this.#ttlSeconds,
      signableHeaders: SIGNED_HEADERS,
      unhoistableHeaders: HEADERS_KEPT_OUT_OF_QUERY,
    };
    try {
      const url = await getSignedUrl(this.#client, command, options);
      return { url, headers: { "Content-Type": upload.contentType, "x-amz-checksum-sha256": checksum } };
    } catch (error) {
      throw new ExternalServiceError("Could not sign the scan upload URL", { cause: error });
    }
  }
}
