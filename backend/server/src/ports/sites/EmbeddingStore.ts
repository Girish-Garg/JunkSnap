import type { EmbeddingVector } from "../../domain/sites/EmbeddingVector.js";

export interface EmbeddingStore {
  // key is a verification_result.embedding_key.
  vectorAt(key: string): Promise<EmbeddingVector>;
}
