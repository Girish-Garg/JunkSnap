import type { Rule } from "../../domain/letters/Rule.js";
import type { RuleBook } from "../../domain/letters/RuleBook.js";
import type { Prose } from "../../domain/letters/types.js";
import { QuoteVerifier } from "./QuoteVerifier.js";

const MAX_SUBJECT = 200;
// Paired quote marks a model may use; ’ alone is an apostrophe, so it never opens a passage.
const QUOTED = /"([^"]*)"|“([^”]*)”|‘([^’]*)’|«([^»]*)»|„([^“”]*)[“”]/gu;
// Any quote mark left once the paired passages are removed means an unclosed or odd quote.
const STRAY_MARK = /["“”‘«»„]/u;

// Passes a draft only when every quoted passage is on a cited page (or is a cited title) and every cited quote is in the body.
export class DraftVerifier {
  readonly #quotes: QuoteVerifier;
  readonly #book: RuleBook;

  constructor(quotes: QuoteVerifier, book: RuleBook) {
    this.#quotes = quotes;
    this.#book = book;
  }

  accepts(prose: Prose, rules: readonly Rule[]): boolean {
    return this.problem(prose, rules) === null;
  }

  // The first reason the draft cannot ship, for the logs; null when it passes.
  problem(prose: Prose, rules: readonly Rule[]): string | null {
    const text = `${prose.subject}\n${prose.body}`;
    const passages = DraftVerifier.passages(text);
    const pages = rules.map((rule) => this.#book.pageText(rule));
    const labels = new Set(rules.flatMap((rule) => rule.labels()).map(QuoteVerifier.normalise));
    const official = (quote: string) =>
      labels.has(QuoteVerifier.normalise(quote)) || pages.some((page) => this.#quotes.found(quote, page));
    const flat = QuoteVerifier.normalise(prose.body);
    const checks: readonly [boolean, string][] = [
      [prose.subject.trim() !== "" && prose.subject.length <= MAX_SUBJECT, "subject empty or too long"],
      [passages.length > 0, "no quoted passage"],
      [passages.every(official), "a quoted passage is not on a cited page"],
      [rules.every((rule) => flat.includes(QuoteVerifier.normalise(rule.exactText))), "a cited quote is missing or changed"],
      [!STRAY_MARK.test(text.replace(QUOTED, "")), "an unclosed or stray quote mark"],
    ];
    return checks.find(([passed]) => !passed)?.[1] ?? null;
  }

  static passages(text: string): string[] {
    return [...text.matchAll(QUOTED)].map((match) => match.slice(1).find((group) => group !== undefined) ?? "");
  }
}
