import type { Rule } from "../../domain/letters/Rule.js";
import type { RuleBook } from "../../domain/letters/RuleBook.js";
import type { CcLine, Prose } from "../../domain/letters/types.js";
import { QuoteVerifier } from "./QuoteVerifier.js";
import type { WordingCheck } from "./WordingCheck.js";

const MAX_SUBJECT = 200;
// Paired quote marks a model may use. A straight ' opens or closes a passage only away from letters, so apostrophes are exempt.
const QUOTED =
  /"([^"]*)"|“([^”]*)”|‘([^’]*)’|«([^»]*)»|„([^“”]*)[“”]|`([^`]*)`|(?<![\p{L}\p{N}])'((?:[^']|'(?=[\p{L}\p{N}]))+)'(?![\p{L}\p{N}])/gu;
// Any quote mark left once the paired passages are removed means an unclosed or odd quote.
const STRAY_MARK = /["“”‘«»„`]/u;

export class DraftVerifier {
  readonly #quotes: QuoteVerifier;
  readonly #book: RuleBook;
  readonly #wording: WordingCheck;

  constructor(quotes: QuoteVerifier, book: RuleBook, wording: WordingCheck) {
    this.#quotes = quotes;
    this.#book = book;
    this.#wording = wording;
  }

  accepts(prose: Prose, rules: readonly Rule[], cc: readonly CcLine[]): boolean {
    return this.problem(prose, rules, cc) === null;
  }

  // The first reason the draft cannot ship, for the logs; null when it passes.
  problem(prose: Prose, rules: readonly Rule[], cc: readonly CcLine[]): string | null {
    const text = `${prose.subject}\n${prose.body}`;
    const passages = DraftVerifier.passages(text);
    const unquoted = text.replace(QUOTED, " ");
    const flat = QuoteVerifier.normalise(prose.body);
    const checks: readonly [boolean, string][] = [
      [prose.subject.trim() !== "" && prose.subject.length <= MAX_SUBJECT, "subject empty or too long"],
      [passages.length > 0, "no quoted passage"],
      [passages.every((quote) => this.#official(quote, rules)), "a quoted passage is not on a cited page"],
      [rules.every((rule) => flat.includes(QuoteVerifier.normalise(rule.exactText))), "a cited quote is missing or changed"],
      [!STRAY_MARK.test(unquoted), "an unclosed or stray quote mark"],
    ];
    return checks.find(([passed]) => !passed)?.[1] ?? this.#wording.problem(unquoted, cc);
  }

  static passages(text: string): string[] {
    return [...text.matchAll(QUOTED)].map((match) => match.slice(1).find((group) => group !== undefined) ?? "");
  }

  // A passage must be on a cited page, or be a cited document or clause label.
  #official(quote: string, rules: readonly Rule[]): boolean {
    const normal = QuoteVerifier.normalise(quote);
    const labelled = rules.some((rule) => rule.labels().some((label) => QuoteVerifier.normalise(label) === normal));
    return labelled || rules.some((rule) => this.#quotes.found(quote, this.#book.pageText(rule)));
  }
}
