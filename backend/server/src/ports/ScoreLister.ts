import type { WardScores } from "../contracts/index.gen.js";
import type { AreaKind } from "../domain/AreaKey.js";

export interface ScoreLister {
  // Every stored row of one kind whose sites lie in the district or local body `within`, in no order.
  listWithin(kind: AreaKind, within: string): Promise<WardScores[]>;
}
