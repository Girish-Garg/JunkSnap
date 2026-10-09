import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const AreaScoresEnv = z.object({
  SCORES_TABLE: z.string().min(1),
});

// GET /areas/{kind}/{id}/scores reads only the scores table.
export class AreaScoresSettings {
  readonly scoresTable: string;

  private constructor(scoresTable: string) {
    this.scoresTable = scoresTable;
  }

  static fromEnv(env: Env): AreaScoresSettings {
    return new AreaScoresSettings(parseEnv(AreaScoresEnv, env).SCORES_TABLE);
  }
}
