import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import { InternalDataError } from "../../domain/errors.js";
import { EmbeddingVector } from "../../domain/sites/EmbeddingVector.js";
import type { EmbeddingStore } from "../../ports/sites/EmbeddingStore.js";
import type { AwsCalls } from "./AwsCalls.js";

// Stored embedding shape in contracts/README.md: {"model", "dim", "vector"}.
const StoredEmbedding = z
  .object({ model: z.string(), dim: z.int().positive(), vector: z.array(z.number()) })
  .refine((embedding) => embedding.vector.length === embedding.dim, "vector length must equal dim");

export class S3EmbeddingStore implements EmbeddingStore {
  readonly #client: S3Client;
  readonly #bucket: string;
  readonly #calls: AwsCalls;

  constructor(client: S3Client, bucket: string, calls: AwsCalls) {
    this.#client = client;
    this.#bucket = bucket;
    this.#calls = calls;
  }

  async vectorAt(key: string): Promise<EmbeddingVector> {
    const text = await this.#calls.run("S3 get embedding", async () => {
      const { Body } = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucket, Key: key }));
      return Body === undefined ? "" : Body.transformToString();
    });
    const parsed = StoredEmbedding.safeParse(S3EmbeddingStore.#json(text, key));
    if (!parsed.success) {
      throw new InternalDataError(`embedding ${key} is malformed: ${z.prettifyError(parsed.error)}`);
    }
    return new EmbeddingVector(parsed.data.vector);
  }

  static #json(text: string, key: string): unknown {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new InternalDataError(`embedding ${key} is not JSON`, { cause: error });
    }
  }
}
