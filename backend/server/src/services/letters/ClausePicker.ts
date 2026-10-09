import type { LetterSite } from "../../domain/letters/LetterSite.js";
import type { Rule } from "../../domain/letters/Rule.js";
import type { RuleBook } from "../../domain/letters/RuleBook.js";
import type { Channel } from "../../domain/letters/types.js";

// Decision 12 names four SWM clauses for a dump letter: 5(1)(f), 15(1), 39(2)(vii) and (xi).
const MAX_CLAUSES = 4;

interface Candidate {
  readonly rule: Rule;
  readonly order: number;
  readonly score: number;
}

// Code, never the model, picks the clauses: best tag match first, then the narrower rule, then file order.
export class ClausePicker {
  readonly #book: RuleBook;
  readonly #maxClauses: number;

  constructor(book: RuleBook, maxClauses: number = MAX_CLAUSES) {
    this.#book = book;
    this.#maxClauses = maxClauses;
  }

  pick(channel: Channel, site: LetterSite): Rule[] {
    const situation = site.situation();
    return this.#book.rules
      .map((rule, order): Candidate => ({ rule, order, score: rule.score(situation) }))
      .filter((candidate) => candidate.score > 0 && candidate.rule.citableIn(channel))
      .sort(ClausePicker.#compare)
      .slice(0, this.#maxClauses)
      .map((candidate) => candidate.rule);
  }

  static #compare(a: Candidate, b: Candidate): number {
    return b.score - a.score || a.rule.breadth() - b.rule.breadth() || a.order - b.order;
  }
}
