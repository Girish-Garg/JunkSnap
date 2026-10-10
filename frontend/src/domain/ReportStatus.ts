// GET /reports/{id} in contracts/README.md: the fields the app reads.
import type { ReportConfirmation } from './ReportConfirmation';
import type { ModerationEvidence, UploadEvidence, VerificationEvidence } from './ReportEvidence';

/**
 * withdrawn: the reporter took it back from an unverified site (decision 20261010-1700).
 * needs_confirmation: the check was unsure and waits for the reporter's answer; not_confirmed: no answer within 24 h (contracts v1.16).
 */
export type ReportStatus =
  | 'queued'
  | 'processing'
  | 'unverified'
  | 'verified'
  | 'rejected'
  | 'needs_review'
  | 'withdrawn'
  | 'needs_confirmation'
  | 'not_confirmed';

export interface ReportStatusView {
  readonly report_id: string;
  readonly status: ReportStatus;
  readonly site_id: string | null;
  /** Public blurred copy; null until moderation has made it. */
  readonly blurred_url: string | null;
  /** The row's last change: the item's freshness token in Activity. */
  readonly updated_at: string;
  /** When the api took the report; GET /me/reports always sends it. */
  readonly received_at?: string;
  /** The report_upload as sent; mock statuses may leave it out. */
  readonly report?: UploadEvidence | null;
  /** Null until moderation ran; mock statuses may leave it out. */
  readonly moderation?: ModerationEvidence | null;
  /** The verification_result, only the fields the app reads. */
  readonly verification?: VerificationEvidence | null;
  /** Null unless the verify step asked the reporter; older statuses leave it out. */
  readonly confirmation?: ReportConfirmation | null;
}

const IN_PIPELINE: ReadonlySet<ReportStatus> = new Set(['queued', 'processing']);
// unverified can still change as people back the site, and needs_confirmation waits for an answer, so neither is final.
const FINAL: ReadonlySet<ReportStatus> = new Set(['verified', 'rejected', 'needs_review', 'withdrawn', 'not_confirmed']);

export class ReportStatuses {
  static inPipeline(status: ReportStatus): boolean {
    return IN_PIPELINE.has(status);
  }

  static isFinal(status: ReportStatus): boolean {
    return FINAL.has(status);
  }
}
