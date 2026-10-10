import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { BLUR_POLICY_METADATA } from "../../src/adapters/moderation/S3ImageStore.js";

// The few S3 reads the re-blur script needs; missing objects come back as null.
export class S3Objects {
  readonly #client: S3Client;

  constructor(client: S3Client) {
    this.#client = client;
  }

  async *keys(bucket: string, prefix: string): AsyncGenerator<string> {
    let token: string | undefined;
    do {
      const page = await this.#client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
      for (const item of page.Contents ?? []) {
        if (item.Key !== undefined) {
          yield item.Key;
        }
      }
      token = page.NextContinuationToken;
    } while (token !== undefined);
  }

  // The blur policy a public copy was written under; null for copies made before policies existed.
  async blurPolicy(bucket: string, key: string): Promise<string | null> {
    const head = await this.#client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.Metadata?.[BLUR_POLICY_METADATA] ?? null;
  }

  async read(bucket: string, key: string): Promise<Uint8Array | null> {
    try {
      const response = await this.#client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return (await response.Body?.transformToByteArray()) ?? null;
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }
}
