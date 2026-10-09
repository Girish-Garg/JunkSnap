import type { AreaFactSheet } from "../domain/AreaFactSheet.js";
import type { AreaKey } from "../domain/AreaKey.js";

export interface SkippedRecord {
  readonly file: string;
  readonly recordId: string;
  readonly error: Error;
}

export interface AreaFacts {
  // localBodyIds: the local bodies of the area's sites, which name the cities whose map layers apply.
  factsFor(area: AreaKey, localBodyIds: readonly string[]): Promise<AreaFactSheet>;
  // Reviewed records left out for breaking ward_record; the job logs and counts them.
  skippedRecords(): readonly SkippedRecord[];
}
