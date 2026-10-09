import type { BrandLabel } from "../../contracts/index.gen.js";
import { InternalDataError } from "../errors.js";
import type { Box } from "./Box.js";
import type { BrandEntry } from "./BrandEntry.js";
import type { ModelSource } from "./TextReading.js";

// contracts/README.md: a brand label needs readable text and confidence 0.8 or more.
export const LABEL_THRESHOLD = 0.8;
// Below the label threshold but at least this, the LLM judge may take a second look.
export const JUDGE_FLOOR = 0.65;

export type Band = "label" | "judge" | "drop";

export interface CandidateFields {
  readonly entry: BrandEntry;
  readonly textSeen: string;
  readonly box: Box;
  readonly confidence: number;
  readonly source: ModelSource;
}

// A brand read on the image: confidence is text confidence times match quality.
export class BrandCandidate {
  readonly entry: BrandEntry;
  readonly textSeen: string;
  readonly box: Box;
  readonly confidence: number;
  readonly #source: ModelSource;

  constructor(fields: CandidateFields) {
    if (!(fields.confidence >= 0 && fields.confidence <= 1)) {
      throw new InternalDataError(`brand confidence out of range: ${fields.confidence}`);
    }
    this.entry = fields.entry;
    this.textSeen = fields.textSeen;
    this.box = fields.box;
    this.confidence = fields.confidence;
    this.#source = fields.source;
  }

  get brand(): string {
    return this.entry.brand;
  }

  band(): Band {
    if (this.confidence >= LABEL_THRESHOLD) {
      return "label";
    }
    return this.confidence >= JUDGE_FLOOR ? "judge" : "drop";
  }

  beats(other: BrandCandidate | undefined): boolean {
    return other === undefined || this.confidence > other.confidence;
  }

  // Rounded down so a label never crosses the threshold; the 1e-9 absorbs float error such as 0.87999...
  toLabel(reportId: string): BrandLabel {
    return {
      report_id: reportId,
      brand: this.entry.brand,
      parent_company: this.entry.parentCompany,
      confidence: Math.floor(this.confidence * 1000 + 1e-9) / 1000,
      text_seen: this.textSeen,
      box: this.box.toContract(),
      mapping_source_url: this.entry.sourceUrl,
      ...this.#source,
    };
  }
}
