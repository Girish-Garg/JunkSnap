import type { ScanFrameUpload } from "../contracts/scanSessionPending.js";

export interface QueuedFrameReport {
  readonly report_id: string;
  readonly upload: ScanFrameUpload;
  readonly received_at: string;
}

// The reports table, only as far as scan frames need it.
export interface FrameReportRepository {
  exists(reportId: string): Promise<boolean>;
  // Writes the row with status queued; an existing row is left as it is.
  createQueued(report: QueuedFrameReport): Promise<void>;
}
