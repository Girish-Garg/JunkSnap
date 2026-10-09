import type { MergeOutcome, ReportRecord } from "../domain/ReportRecord.js";

// Sites task: merges the report into a site, skipping report ids it already holds.
export interface ReportMerger {
  merge(report: ReportRecord): Promise<MergeOutcome>;
}
