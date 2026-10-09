import type { ScanRecord, ScanUpdate } from "../domain/ScanRecord.js";

export interface ScanRepository {
  // False when a scan with this id is already stored; the stored one stays as it is.
  create(record: ScanRecord): Promise<boolean>;
  find(scanId: string): Promise<ScanRecord | undefined>;
  update(scanId: string, update: ScanUpdate): Promise<void>;
}
