import type { WardScores } from "../contracts/index.gen.js";
import type { ComputedAreaScores } from "../domain/AreaInsights.js";
import type { AreaKey } from "../domain/AreaKey.js";

export interface ScoreRepository {
  // Overwrites the area's row.
  save(row: ComputedAreaScores): Promise<void>;
  find(area: AreaKey): Promise<WardScores | null>;
}
