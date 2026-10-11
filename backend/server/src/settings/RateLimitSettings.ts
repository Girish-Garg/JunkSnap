import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

// Every per-hour limit, counted per user and per device (contracts/README.md, Rate limit). Defaults are the contract's.
const RateLimitEnv = z.object({
  SNAP_PER_HOUR: z.coerce.number().int().min(1).default(20),
  CONFIRMATIONS_PER_HOUR: z.coerce.number().int().min(1).default(20),
  LETTERS_PER_HOUR: z.coerce.number().int().min(1).default(5),
  FLAGS_PER_HOUR: z.coerce.number().int().min(1).default(10),
  WITHDRAWALS_PER_HOUR: z.coerce.number().int().min(1).default(10),
});

export class RateLimitSettings {
  readonly snapPerHour: number;
  readonly confirmationsPerHour: number;
  readonly lettersPerHour: number;
  readonly flagsPerHour: number;
  readonly withdrawalsPerHour: number;

  private constructor(values: z.output<typeof RateLimitEnv>) {
    this.snapPerHour = values.SNAP_PER_HOUR;
    this.confirmationsPerHour = values.CONFIRMATIONS_PER_HOUR;
    this.lettersPerHour = values.LETTERS_PER_HOUR;
    this.flagsPerHour = values.FLAGS_PER_HOUR;
    this.withdrawalsPerHour = values.WITHDRAWALS_PER_HOUR;
  }

  static fromEnv(env: Env): RateLimitSettings {
    return new RateLimitSettings(parseEnv(RateLimitEnv, env));
  }
}
