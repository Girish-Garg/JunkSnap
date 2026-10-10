import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ExternalServiceError } from "../domain/errors.js";
import type { UploadSigner, UploadSignRequest } from "../ports/UploadSigner.js";

const CHECKSUM_HEADER = "x-amz-checksum-sha256";

// Signs content-type and the checksum as headers (not query), so S3 rejects any other type or bytes.
export class S3UploadSigner implements UploadSigner {
  readonly #client: S3Client;
  readonly #bucket: string;

  constructor(client: S3Client, bucket: string) {
    this.#client = client;
    this.#bucket = bucket;
  }

  async sign(request: UploadSignRequest): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.#bucket,
      Key: request.key,
      ContentType: request.contentType,
      ChecksumSHA256: request.checksumBase64,
    });
    try {
      return await getSignedUrl(this.#client, command, {
        expiresIn: request.expiresInSeconds,
        signableHeaders: new Set(["content-type", CHECKSUM_HEADER]),
        unhoistableHeaders: new Set([CHECKSUM_HEADER]),
      });
    } catch (error) {
      throw new ExternalServiceError("Could not sign the upload URL", { cause: error });
    }
  }
}
