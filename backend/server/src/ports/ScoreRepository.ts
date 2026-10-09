import type { AreaScoresRow } from "../domain/AreaInsights.js";
import type { AreaKey } from "../domain/AreaKey.js";

export interface ScoreRepository {
  // Overwrites the area's row.
  save(row: AreaScoresRow): Promise<void>;
  find(area: AreaKey): Promise<AreaScoresRow | null>;
}
