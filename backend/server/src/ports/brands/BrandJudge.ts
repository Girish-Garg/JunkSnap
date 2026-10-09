import type { BlurredImage } from "../../domain/brands/BlurredImage.js";
import type { Box } from "../../domain/brands/Box.js";
import type { BrandEntry } from "../../domain/brands/BrandEntry.js";
import type { ModelSource } from "../../domain/brands/TextReading.js";

// One region to look at, with the only brands the judge may name there.
export interface JudgeCase {
  readonly id: string;
  readonly textSeen: string;
  readonly box: Box;
  readonly options: readonly BrandEntry[];
}

// brand is null when none of the options is readable; textSeen is what the model read.
export interface JudgeVerdict {
  readonly caseId: string;
  readonly brand: string | null;
  readonly confidence: number;
  readonly textSeen: string;
  readonly source: ModelSource;
}

// The LLM step: only near-threshold matches and text the OCR could not read reach it.
export interface BrandJudge {
  judge(image: BlurredImage, cases: readonly JudgeCase[]): Promise<readonly JudgeVerdict[]>;
}
