import { z } from "zod";
import type { ModelLimits } from "../domain/llm/ModelLimits.js";
import { parseTunables, type Env } from "./utils.js";

const tokens = (fallback: number) => z.coerce.number().int().min(10).max(16_000).default(fallback);

const ModelLimitEnv = z.object({
  LETTER_MAX_TOKENS: tokens(1_500),
  AREA_LETTER_MAX_TOKENS: tokens(2_000),
  // Copying quotes word for word matters more than varied prose.
  LETTER_TEMPERATURE: z.coerce.number().min(0).max(1).default(0),
  BRAND_JUDGE_MAX_TOKENS: tokens(600),
  NOTE_MODERATION_MAX_TOKENS: tokens(60),
  NOTE_ANALYSIS_MAX_TOKENS: tokens(500),
});

// The answer size (and, for letters, the sampling temperature) of each model task.
export class ModelLimitSettings {
  readonly letters: ModelLimits;
  readonly areaLetters: ModelLimits;
  readonly brandJudgeMaxTokens: number;
  readonly noteModerationMaxTokens: number;
  readonly noteAnalysisMaxTokens: number;

  private constructor(values: z.output<typeof ModelLimitEnv>) {
    const temperature = values.LETTER_TEMPERATURE;
    this.letters = Object.freeze({ maxTokens: values.LETTER_MAX_TOKENS, temperature });
    this.areaLetters = Object.freeze({ maxTokens: values.AREA_LETTER_MAX_TOKENS, temperature });
    this.brandJudgeMaxTokens = values.BRAND_JUDGE_MAX_TOKENS;
    this.noteModerationMaxTokens = values.NOTE_MODERATION_MAX_TOKENS;
    this.noteAnalysisMaxTokens = values.NOTE_ANALYSIS_MAX_TOKENS;
    Object.freeze(this);
  }

  static fromEnv(env: Env): ModelLimitSettings {
    return new ModelLimitSettings(parseTunables(ModelLimitEnv, env));
  }
}
