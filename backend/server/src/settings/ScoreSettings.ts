import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

// Area scores and everything that withholds by them (area letters, zero-count rows); api, worker and scores agree.
const ScoreEnv = z.object({
  MIN_VERIFIED_REPORTS: z.coerce.number().int().min(1).max(10_000).default(10),
  MIN_BIN_SERVICE_SITES: z.coerce.number().int().min(1).max(10_000).default(3),
});

export class ScoreSettings {
  // Verified reports an area needs before a score, an area share or an area letter shows.
  readonly minVerifiedReports: number;
  // Verified overflowing-bin sites an area needs before bin_service_pct counts.
  readonly minBinServiceSites: number;

  private constructor(values: z.output<typeof ScoreEnv>) {
    this.minVerifiedReports = values.MIN_VERIFIED_REPORTS;
    this.minBinServiceSites = values.MIN_BIN_SERVICE_SITES;
    Object.freeze(this);
  }

  static fromEnv(env: Env): ScoreSettings {
    return new ScoreSettings(parseEnv(ScoreEnv, env));
  }
}
