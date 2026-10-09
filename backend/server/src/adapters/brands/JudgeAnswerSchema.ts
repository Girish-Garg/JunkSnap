import { z } from "zod";
import type { JudgeAnswer } from "../../domain/brands/JudgeAnswer.js";
import type { AnswerSchema } from "../../domain/llm/AnswerSchema.js";

// The router retries once, then tries the next model, when an answer fails this schema.
export const JUDGE_ANSWER_SCHEMA: AnswerSchema<JudgeAnswer> = z.object({
  verdicts: z.array(
    z.object({
      case_id: z.string().min(1),
      brand: z.string().min(1).nullable(),
      confidence: z.number().min(0).max(1),
      text_seen: z.string(),
    }),
  ),
});
