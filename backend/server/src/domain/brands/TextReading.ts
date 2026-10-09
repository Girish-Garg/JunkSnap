import type { BrandLabel } from "../../contracts/index.gen.js";
import type { Box } from "./Box.js";

export interface ModelSource {
  readonly provider: BrandLabel["provider"];
  readonly model: string;
  readonly version: string;
}

// Confidence is 0 to 1 everywhere in the brand step.
export interface TextWord {
  readonly text: string;
  readonly confidence: number;
  readonly box: Box;
}

export interface TextLine {
  readonly text: string;
  readonly confidence: number;
  readonly words: readonly TextWord[];
}

export interface TextReading {
  readonly lines: readonly TextLine[];
  readonly source: ModelSource;
}
