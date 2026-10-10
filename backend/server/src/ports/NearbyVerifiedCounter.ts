import type { ReportRecord } from "../domain/ReportRecord.js";

// Sites task: verified reports of the same type within about 40 m, before merging.
export interface NearbyVerifiedCounter {
  count(report: ReportRecord): Promise<number>;
}
