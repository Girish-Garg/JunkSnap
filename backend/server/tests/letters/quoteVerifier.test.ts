import { beforeAll, describe, expect, it } from "vitest";
import { AssetFiles } from "../../src/adapters/letters/AssetFiles.js";
import { RuleRepository } from "../../src/adapters/letters/RuleRepository.js";
import { Rule } from "../../src/domain/letters/Rule.js";
import type { RuleBook } from "../../src/domain/letters/RuleBook.js";
import { DraftVerifier } from "../../src/services/letters/DraftVerifier.js";
import { QuoteVerifier } from "../../src/services/letters/QuoteVerifier.js";
import { FIXTURE_RULES_DIR, REAL_RULES_DIR } from "./support.js";

const PAGE = "(x) schedule for street sweeping and placement of waste bins as per\n  prescribed norms;\nएक नियम लागू है।";

let book: RuleBook;
let quotes: QuoteVerifier;

beforeAll(async () => {
  book = await new RuleRepository(new AssetFiles(FIXTURE_RULES_DIR)).load();
  quotes = new QuoteVerifier(book);
});

function rule(id: string) {
  const found = book.rules.find((candidate) => candidate.ruleId === id);
  if (found === undefined) {
    throw new Error(`fixture has no rule ${id}`);
  }
  return found;
}

describe("QuoteVerifier.found", () => {
  it("matches word for word across line breaks and runs of spaces", () => {
    expect(quotes.found("placement of waste bins as per prescribed norms", PAGE)).toBe(true);
    expect(quotes.found("placement  of waste\tbins", PAGE)).toBe(true);
  });

  it.each([
    ["a changed word", "placement of waste bins as per required norms"],
    ["a dropped word", "placement of bins as per prescribed norms"],
    ["different case", "Placement of waste bins"],
    ["a quote ending inside a word", "placement of waste bin"],
    ["a quote starting inside a word", "lacement of waste bins"],
    ["an empty quote", "  "],
  ])("rejects %s", (_name, quote) => {
    expect(quotes.found(quote, PAGE)).toBe(false);
  });

  it("allows punctuation next to the quote but not letters", () => {
    expect(quotes.found("prescribed norms", PAGE)).toBe(true);
    expect(quotes.found("(x) schedule", PAGE)).toBe(true);
    expect(quotes.found("x) schedule", PAGE)).toBe(true);
    expect(quotes.found("x) schedule", "(ax) schedule")).toBe(false);
  });

  it("treats Devanagari letters and vowel signs as word characters", () => {
    expect(quotes.found("नियम लागू है", PAGE)).toBe(true);
    expect(quotes.found("नियम लाग", PAGE)).toBe(false);
  });

  it("keeps looking past a first match that sits inside a word", () => {
    expect(quotes.found("bins", "cabins and waste bins")).toBe(true);
  });
});

describe("QuoteVerifier.check", () => {
  it("passes every fixture quote: verified N of N", () => {
    const checked = quotes.check(book.rules);
    expect(checked.verified).toBe(book.rules.length);
    expect(checked.total).toBe(book.rules.length);
    expect(checked.citations.every((citation) => citation.verified)).toBe(true);
    expect(quotes.unverifiedRules()).toEqual([]);
  });

  const binsRule = (exactText: string, clauseMarker = "(x)") =>
    new Rule({
      ruleId: "fx-bins-variant",
      document: "Sample Waste Rules (test fixture)",
      clause: "39(2)(x)",
      clauseMarker,
      exactText,
      page: 3,
      textFile: "texts/sample_rules_en.txt",
      sourceSha256: "f".repeat(64),
      tags: ["no_bin"],
      channels: ["local_body"],
    });

  it("reports a misquoted rule as unverified and never cites it", () => {
    const checked = quotes.check([rule("fx-dumpsites"), binsRule("placement of waste bins as per new norms")]);
    expect(checked).toMatchObject({ verified: 1, total: 2 });
    expect(checked.citations.map((citation) => citation.rule_id)).toEqual(["fx-dumpsites"]);
  });

  it("verifies a rule's quote only right after its clause marker", () => {
    expect(quotes.verifies(binsRule("schedule for street sweeping"))).toBe(true);
    expect(quotes.verifies(binsRule("placement of waste bins as per prescribed norms"))).toBe(false);
    expect(quotes.verifies(binsRule("schedule for street sweeping", "(xi)"))).toBe(false);
  });

  it("finds all 21 real quotes word for word on their stored page", async () => {
    const real = await new RuleRepository(new AssetFiles(REAL_RULES_DIR)).load();
    const verifier = new QuoteVerifier(real);
    expect(real.rules).toHaveLength(21);
    expect(verifier.unverifiedRules().map((failed) => failed.ruleId)).toEqual([]);
  });
});

describe("DraftVerifier", () => {
  const bins = () => rule("fx-bins");
  const quoting = (quote: string, rest = "") => `Rule 39(2)(x) says "${quote}". Please act.${rest}`;
  const accepts = (body: string, rules = [bins()], subject = "Request") =>
    new DraftVerifier(quotes, book).accepts({ subject, body }, rules);

  it("accepts a draft that quotes each cited rule word for word", () => {
    expect(accepts(quoting(bins().exactText))).toBe(true);
  });

  it("accepts curly quotes and a shorter passage from the cited page", () => {
    expect(accepts(`“${bins().exactText}” and “street sweeping”`)).toBe(true);
  });

  it("allows a cited document title or clause in quotes, but nothing else", () => {
    expect(accepts(quoting(bins().exactText, ' See "Sample Waste Rules (test fixture)", "39(2)(x)".'))).toBe(true);
    expect(accepts(quoting(bins().exactText, ' See "Sample Waste Rules (test fixture), 39(2)(x)".'))).toBe(true);
    expect(accepts(quoting(bins().exactText, ' See "Sample Waste Rules".'))).toBe(false);
  });

  it("keeps an apostrophe out of the quote check", () => {
    expect(accepts(quoting(bins().exactText, " The ward’s residents ask for this."))).toBe(true);
  });

  it("rejects a misquote", () => {
    expect(accepts(quoting("schedule for street sweeping and placement of bins"))).toBe(false);
  });

  it.each([
    ["straight", '"bins must be emptied daily"'],
    ["curly", "“bins must be emptied daily”"],
    ["single curly", "‘bins must be emptied daily’"],
    ["guillemet", "«bins must be emptied daily»"],
    ["low-high", "„bins must be emptied daily“"],
  ])("rejects an extra %s-quoted passage that is not on a cited page", (_name, extra) => {
    expect(accepts(quoting(bins().exactText, ` The law says ${extra}.`))).toBe(false);
  });

  it("rejects an unclosed quote", () => {
    expect(accepts(quoting(bins().exactText, ' The law says "bins must be emptied daily.'))).toBe(false);
  });

  it("checks quotes in the subject too", () => {
    expect(accepts(quoting(bins().exactText), [bins()], 'Rule says "fines double"')).toBe(false);
  });

  it("rejects a draft that leaves out a cited quote", () => {
    expect(accepts(quoting(bins().exactText), [bins(), rule("fx-dumpsites")])).toBe(false);
  });

  it("rejects a draft with no quotes at all", () => {
    expect(accepts("Please clear the site.")).toBe(false);
  });
});
