import type { WardScores } from "../../contracts/index.gen.js";

export interface AreaScoreSeeder {
  // Conditional write: an existing row for the area is never overwritten; within is stored beside the row.
  seedIfMissing(row: WardScores, within: readonly string[]): Promise<void>;
}
