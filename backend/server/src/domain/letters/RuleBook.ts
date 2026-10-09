import { InternalDataError } from "../errors.js";
import type { Rule } from "./Rule.js";

// Stored text file name -> PDF page number -> page text.
export type PageTexts = ReadonlyMap<string, ReadonlyMap<number, string>>;

export class RuleBook {
  readonly rules: readonly Rule[];
  readonly #pages: PageTexts;

  constructor(rules: readonly Rule[], pages: PageTexts) {
    this.rules = rules;
    this.#pages = pages;
  }

  pageText(rule: Rule): string {
    const text = this.#pages.get(rule.textFile)?.get(rule.page);
    if (text === undefined) {
      throw new InternalDataError(`No stored page ${rule.page} in ${rule.textFile} for ${rule.ruleId}`);
    }
    return text;
  }
}
