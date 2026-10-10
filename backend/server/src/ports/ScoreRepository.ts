import type { WardScores } from "../contracts/index.gen.js";
import type { ComputedAreaScores } from "../domain/AreaInsights.js";
import type { AreaKey } from "../domain/AreaKey.js";

export interface ScoreRepository {
  // Overwrites the area's row; within holds the district and local body ids of the area's sites.
  save(row: ComputedAreaScores, within: readonly string[]): Promise<void>;
  find(area: AreaKey): Promise<WardScores | null>;
}
