// GET /reports/{id} in contracts/README.md: the fields the app reads.
/** withdrawn: the reporter took it back from an unverified site (decision 20261010-1700). */
export type ReportStatus = 'queued' | 'processing' | 'unverified' | 'verified' | 'rejected' | 'needs_review' | 'withdrawn';

export interface ReportStatusView {
  readonly report_id: string;
  readonly status: ReportStatus;
  readonly site_id: string | null;
  /** Public blurred copy; null until moderation has made it. */
  readonly blurred_url: string | null;
  readonly updated_at: string;
}

const IN_PIPELINE: ReadonlySet<ReportStatus> = new Set(['queued', 'processing']);
// unverified can still change as people back the site, so it is not final.
const FINAL: ReadonlySet<ReportStatus> = new Set(['verified', 'rejected', 'needs_review', 'withdrawn']);

export class ReportStatuses {
  static inPipeline(status: ReportStatus): boolean {
    return IN_PIPELINE.has(status);
  }

  static isFinal(status: ReportStatus): boolean {
    return FINAL.has(status);
  }
}
