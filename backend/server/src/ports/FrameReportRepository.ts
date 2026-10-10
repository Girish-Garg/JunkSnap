import type { ReportUpload } from "../contracts/index.gen.js";
import type { AutoClaimKind } from "../domain/scout/AutoClaim.js";

export interface QueuedFrameReport {
  readonly report_id: string;
  readonly upload: ReportUpload;
  readonly received_at: string;
  readonly auto_claim?: AutoClaimKind;
  // t_ms of the first frame of this frame's spot; frames of one spot and type merge into one site.
  readonly scan_spot?: number;
}

// The reports table, only as far as scan frames need it.
export interface FrameReportRepository {
  exists(reportId: string): Promise<boolean>;
  // Writes the row with status queued; an existing row is left as it is.
  createQueued(report: QueuedFrameReport): Promise<void>;
}
