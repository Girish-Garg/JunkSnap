import type { AreaFactSheet } from "../domain/AreaFactSheet.js";
import type { AreaKey } from "../domain/AreaKey.js";

export interface AreaFacts {
  // localBodyIds: the local bodies of the area's sites, which name the cities whose map layers apply.
  factsFor(area: AreaKey, localBodyIds: readonly string[]): Promise<AreaFactSheet>;
}
