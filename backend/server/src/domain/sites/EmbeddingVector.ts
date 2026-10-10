export class EmbeddingVector {
  readonly #values: readonly number[];

  constructor(values: readonly number[]) {
    this.#values = [...values];
  }

  // Null when the sizes differ: vectors from two embedding models cannot be compared.
  cosine(other: EmbeddingVector): number | null {
    const a = this.#values;
    const b = other.#values;
    if (a.length !== b.length) {
      return null;
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
