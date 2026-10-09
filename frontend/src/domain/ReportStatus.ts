// GET /reports/{id} in contracts/README.md: the fields the app reads.
export type ReportStatus = 'queued' | 'processing' | 'verified' | 'community_check' | 'rejected' | 'needs_review';

export interface ReportStatusView {
  readonly report_id: string;
  readonly status: ReportStatus;
  readonly site_id: string | null;
  /** Public blurred copy; null until moderation has made it. */
  readonly blurred_url: string | null;
  readonly updated_at: string;
}

const IN_PIPELINE: ReadonlySet<ReportStatus> = new Set(['queued', 'processing']);
// community_check can still change when neighbours vote, so it is not final.
const FINAL: ReadonlySet<ReportStatus> = new Set(['verified', 'rejected', 'needs_review']);

export class ReportStatuses {
  static inPipeline(status: ReportStatus): boolean {
    return IN_PIPELINE.has(status);
  }

  static isFinal(status: ReportStatus): boolean {
    return FINAL.has(status);
  }
}
