import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const ScoresEnv = z.object({
  SITES_TABLE: z.string().min(1),
  REPORTS_TABLE: z.string().min(1),
  SCORES_TABLE: z.string().min(1),
  ASSETS_DIR: z.string().min(1).optional(),
});

// The scores CronJob; without ASSETS_DIR no ward records load, so km² and disposal-point scores show no_data.
export class ScoresSettings {
  readonly sitesTable: string;
  readonly reportsTable: string;
  readonly scoresTable: string;
  readonly assetsDir: string | null;

  private constructor(values: z.output<typeof ScoresEnv>) {
    this.sitesTable = values.SITES_TABLE;
    this.reportsTable = values.REPORTS_TABLE;
    this.scoresTable = values.SCORES_TABLE;
    this.assetsDir = values.ASSETS_DIR ?? null;
  }

  static fromEnv(env: Env): ScoresSettings {
    return new ScoresSettings(parseEnv(ScoresEnv, env));
  }
}
