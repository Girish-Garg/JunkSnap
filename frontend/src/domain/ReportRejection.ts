import type { ReportStatusView } from './ReportStatus';

/** A user-safe reason code for a turned-down report. */
export type RejectionReason = 'not_waste';

export class ReportRejection {
  /** not_waste: the models found no waste of the reported kind (issue 103). Null for any other outcome. */
  static reasonOf(view: ReportStatusView | null | undefined): RejectionReason | null {
    if (view?.status !== 'rejected' || view.moderation?.outcome === 'rejected') return null;
    return view.verification?.decision === 'rejected' ? 'not_waste' : null;
  }
}
