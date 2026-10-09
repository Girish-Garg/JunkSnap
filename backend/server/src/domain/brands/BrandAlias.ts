const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{M}\p{N}]/gu;
const DEVANAGARI = /\p{Script=Devanagari}/u;

// One spelling of a brand; quality() is 1 for an exact match and 0 for no match.
export class BrandAlias {
  readonly text: string;
  readonly words: number;
  readonly #normalised: string;
  readonly #requireExact: boolean;

  constructor(text: string, requireExact: boolean) {
    this.text = text;
    this.words = BrandAlias.wordsOf(text).length;
    this.#normalised = BrandAlias.normalise(text);
    this.#requireExact = requireExact;
  }

  // NFKC, then upper-then-lower case as a casefold, then letters, marks and digits only: "Lay's" -> "lays".
  static normalise(text: string): string {
    return text.normalize("NFKC").toUpperCase().toLowerCase().replace(NOT_LETTER_OR_DIGIT, "");
  }

  // Punctuation-only tokens such as "&" or "-" are not words.
  static wordsOf(text: string): string[] {
    return text.split(/\s+/).filter((word) => BrandAlias.normalise(word) !== "");
  }

  isDevanagari(): boolean {
    return DEVANAGARI.test(this.#normalised);
  }

  quality(normalisedRun: string): number {
    if (normalisedRun === this.#normalised) {
      return 1;
    }
    if (normalisedRun.includes(this.#normalised)) {
      return 0;
    }
    const length = [...this.#normalised].length;
    const distance = BrandAlias.#distance([...normalisedRun], [...this.#normalised]);
    return distance <= this.#editBudget(length) ? 1 - distance / length : 0;
  }

  #editBudget(length: number): number {
    if (this.#requireExact || length < 5) {
      return 0;
    }
    return length >= 9 ? 2 : 1;
  }

  // Levenshtein distance over code points.
  static #distance(a: readonly string[], b: readonly string[]): number {
    let previous = Array.from({ length: b.length + 1 }, (_unused, index) => index);
    for (const [i, charA] of a.entries()) {
      const current = [i + 1];
      for (const [j, charB] of b.entries()) {
        const substitution = (previous[j] ?? 0) + (charA === charB ? 0 : 1);
        current.push(Math.min((previous[j + 1] ?? 0) + 1, (current[j] ?? 0) + 1, substitution));
      }
      previous = current;
    }
    return previous[b.length] ?? 0;
  }
}
