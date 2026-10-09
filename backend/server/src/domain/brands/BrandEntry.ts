import type { BrandAlias } from "./BrandAlias.js";

export interface BrandEntryFields {
  readonly brand: string;
  readonly parentCompany: string;
  readonly sourceUrl: string;
  readonly aliases: readonly BrandAlias[];
}

// One row of data/brands/brands.json.
export class BrandEntry {
  readonly brand: string;
  readonly parentCompany: string;
  readonly sourceUrl: string;
  readonly aliases: readonly BrandAlias[];

  constructor(fields: BrandEntryFields) {
    this.brand = fields.brand;
    this.parentCompany = fields.parentCompany;
    this.sourceUrl = fields.sourceUrl;
    this.aliases = [...fields.aliases];
  }

  // Best quality over the aliases with the same number of words as the run.
  quality(normalisedRun: string, words: number): number {
    const sameLength = this.aliases.filter((alias) => alias.words === words);
    return Math.max(0, ...sameLength.map((alias) => alias.quality(normalisedRun)));
  }

  hasDevanagari(): boolean {
    return this.aliases.some((alias) => alias.isDevanagari());
  }
}
