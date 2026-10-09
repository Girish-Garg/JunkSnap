import { InternalDataError } from "../errors.js";

export class EmbeddingVector {
  readonly #values: readonly number[];

  constructor(values: readonly number[]) {
    this.#values = [...values];
  }

  cosine(other: EmbeddingVector): number {
    const a = this.#values;
    const b = other.#values;
    if (a.length !== b.length) {
      throw new InternalDataError(`embedding sizes differ: ${a.length} and ${b.length}`);
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    a.forEach((value, index) => {
      const paired = b[index] ?? 0;
      dot += value * paired;
      normA += value * value;
      normB += paired * paired;
    });
    const norms = Math.sqrt(normA) * Math.sqrt(normB);
    return norms === 0 ? 0 : dot / norms;
  }
}
