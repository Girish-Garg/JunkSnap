import { z } from "zod";
import { parseTunables, type Env } from "./utils.js";

const tries = (max: number, fallback: number) => z.coerce.number().int().min(1).max(max).default(fallback);

const RetryEnv = z.object({
  SAVE_ATTEMPTS: tries(20, 3),
  COUNTER_ATTEMPTS: tries(20, 5),
  COUNTER_JITTER_MS: z.coerce.number().int().min(0).max(1_000).default(25),
  BATCH_READ_ATTEMPTS: tries(20, 3),
  LLM_JSON_RETRIES: z.coerce.number().int().min(0).max(5).default(1),
});

// How often a write or read that lost a race, or an answer that broke its schema, is tried again.
export class RetrySettings {
  // A conditional save that lost to a concurrent one: votes, cleanups, withdrawals, photo reports, confirmations.
  readonly saveAttempts: number;
  // Windowed rate-limit counters: conditional misses, with a random pause up to jitterMs between them.
  readonly counter: { readonly attempts: number; readonly jitterMs: number };
  // Keys DynamoDB BatchGetItem left unprocessed.
  readonly batchReadAttempts: number;
  // Reminders after a model answer that is not the JSON its task asked for.
  readonly jsonRetries: number;

  private constructor(values: z.output<typeof RetryEnv>) {
    this.saveAttempts = values.SAVE_ATTEMPTS;
    this.counter = Object.freeze({ attempts: values.COUNTER_ATTEMPTS, jitterMs: values.COUNTER_JITTER_MS });
    this.batchReadAttempts = values.BATCH_READ_ATTEMPTS;
    this.jsonRetries = values.LLM_JSON_RETRIES;
    Object.freeze(this);
  }

  static fromEnv(env: Env): RetrySettings {
    return new RetrySettings(parseTunables(RetryEnv, env));
  }
}
