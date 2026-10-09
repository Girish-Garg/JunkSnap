import type { WardScores } from "../../contracts/index.gen.js";

export interface AreaScoreSeeder {
  // Conditional write: an existing row for the area is never overwritten.
  seedIfMissing(row: WardScores): Promise<void>;
}
