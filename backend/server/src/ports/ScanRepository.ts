import type { ScanRecord, ScanUpdate } from "../domain/ScanRecord.js";

export interface ScanRepository {
  // False when a scan with this id is already stored; the stored one stays as it is.
  create(record: ScanRecord): Promise<boolean>;
  find(scanId: string): Promise<ScanRecord | undefined>;
  update(scanId: string, update: ScanUpdate): Promise<void>;
  // Sets only report_ids and updated_at, never status; false when the scan is already done or failed, which stays as it is.
  recordReports(scanId: string, reportIds: readonly string[], updatedAt: string): Promise<boolean>;
}
