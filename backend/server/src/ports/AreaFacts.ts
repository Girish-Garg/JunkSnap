import type { AreaFactSheet } from "../domain/AreaFactSheet.js";
import type { AreaKey } from "../domain/AreaKey.js";

export interface AreaFacts {
  factsFor(area: AreaKey): Promise<AreaFactSheet>;
}
