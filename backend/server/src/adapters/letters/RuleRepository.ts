import { createHash } from "node:crypto";
import { z } from "zod";
import { ConfigError } from "../../domain/errors.js";
import { Rule } from "../../domain/letters/Rule.js";
import { RuleBook } from "../../domain/letters/RuleBook.js";
import type { AssetFiles } from "./AssetFiles.js";
import { channelSchema } from "./vocabulary.js";

const PAGE_MARKER = /^=== PDF page (\d+) ===$/m;
const SHA256 = /^[0-9a-f]{64}$/;

const TextEntry = z.object({
  text_file: z.string().min(1),
  text_sha256: z.string().regex(SHA256),
  document: z.string().min(1),
  source_sha256: z.string().regex(SHA256),
});

const RuleEntry = z.object({
  rule_id: z.string().min(1),
  document: z.string().min(1),
  clause: z.string().min(1),
  clause_marker: z.string().min(1),
  exact_text: z.string().min(1),
  page: z.number().int().positive(),
  text_file: z.string().min(1),
  source_sha256: z.string().regex(SHA256),
  situation_tags: z.array(z.string()).min(1),
  channels: z.array(channelSchema).min(1),
});

const RulesFile = z.object({ texts: z.array(TextEntry), rules: z.array(RuleEntry) });

type TextEntry = z.output<typeof TextEntry>;
type RuleEntry = z.output<typeof RuleEntry>;

export class RuleRepository {
  readonly #files: AssetFiles;

  constructor(files: AssetFiles) {
    this.#files = files;
  }

  async load(): Promise<RuleBook> {
    const book = await this.#files.json("rules.json", RulesFile);
    book.rules.forEach((rule) => RuleRepository.#checkSource(rule, book.texts));
    const pages = await Promise.all(book.texts.map(async (entry) => [entry.text_file, await this.#pages(entry)] as const));
    return new RuleBook(book.rules.map(RuleRepository.#rule), new Map(pages));
  }

  async #pages(entry: TextEntry): Promise<Map<number, string>> {
    const bytes = await this.#files.bytes(entry.text_file);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== entry.text_sha256) {
      throw new ConfigError(`${entry.text_file}: SHA-256 ${actual} does not match rules.json ${entry.text_sha256}`);
    }
    return RuleRepository.#splitPages(bytes.toString("utf8"));
  }

  // A citation prints the rule's document and hash, so both must match the text the quote is checked in.
  static #checkSource(rule: RuleEntry, texts: readonly TextEntry[]): void {
    const text = texts.find((entry) => entry.text_file === rule.text_file);
    if (text?.document !== rule.document || text.source_sha256 !== rule.source_sha256) {
      throw new ConfigError(`rules.json: ${rule.rule_id} does not match the text entry for ${rule.text_file}`);
    }
  }

  // split() with one capture group gives [preamble, page, text, page, text, ...].
  static #splitPages(text: string): Map<number, string> {
    const parts = text.split(PAGE_MARKER);
    const pages = new Map<number, string>();
    for (let index = 1; index + 1 < parts.length; index += 2) {
      pages.set(Number(parts[index]), parts[index + 1] ?? "");
    }
    return pages;
  }

  static #rule(entry: RuleEntry): Rule {
    return new Rule({
      ruleId: entry.rule_id,
      document: entry.document,
      clause: entry.clause,
      clauseMarker: entry.clause_marker,
      exactText: entry.exact_text,
      page: entry.page,
      textFile: entry.text_file,
      sourceSha256: entry.source_sha256,
      tags: entry.situation_tags,
      channels: entry.channels,
    });
  }
}
