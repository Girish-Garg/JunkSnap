import type { Rule } from "../../domain/letters/Rule.js";
import type { RuleBook } from "../../domain/letters/RuleBook.js";
import type { Citation } from "../../domain/letters/types.js";

const WORD_CHAR = /[\p{L}\p{M}\p{N}_]/u;
const WHITESPACE_RUN = /\s+/gu;

export interface CheckedCitations {
  readonly citations: readonly Citation[];
  readonly verified: number;
  readonly total: number;
}

// Word for word, as scripts/check_rules.py: case-sensitive, whitespace runs equal one space, no word char on either side.
export class QuoteVerifier {
  readonly #book: RuleBook;

  constructor(book: RuleBook) {
    this.#book = book;
  }

  static normalise(text: string): string {
    return text.replace(WHITESPACE_RUN, " ").trim();
  }

  found(quote: string, text: string): boolean {
    return QuoteVerifier.#starts(quote, text).length > 0;
  }

  // A rule's quote must also follow its clause marker, so it cannot match the same words in another clause.
  verifies(rule: Rule): boolean {
    const page = QuoteVerifier.normalise(this.#book.pageText(rule));
    const marker = QuoteVerifier.normalise(rule.clauseMarker);
    const starts = QuoteVerifier.#starts(rule.exactText, page);
    return marker !== "" && starts.some((at) => page.slice(0, at).trimEnd().endsWith(marker));
  }

  // Only rules whose quote is found become citations; the counts are "verified N of N".
  check(rules: readonly Rule[]): CheckedCitations {
    const passed = rules.filter((rule) => this.verifies(rule));
    return {
      citations: passed.map((rule) => rule.verifiedCitation()),
      verified: passed.length,
      total: rules.length,
    };
  }

  unverifiedRules(): Rule[] {
    return this.#book.rules.filter((rule) => !this.verifies(rule));
  }

  static #starts(quote: string, text: string): number[] {
    const needle = QuoteVerifier.normalise(quote);
    const haystack = QuoteVerifier.normalise(text);
    const starts: number[] = [];
    for (let at = haystack.indexOf(needle); needle !== "" && at !== -1; at = haystack.indexOf(needle, at + 1)) {
      if (QuoteVerifier.#onWordEdges(haystack, at, needle.length)) {
        starts.push(at);
      }
    }
    return starts;
  }

  static #onWordEdges(text: string, at: number, length: number): boolean {
    const before = text.charAt(at - 1);
    const after = text.charAt(at + length);
    return !WORD_CHAR.test(before) && !WORD_CHAR.test(after);
  }
}
