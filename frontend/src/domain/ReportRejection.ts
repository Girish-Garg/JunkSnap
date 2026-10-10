import type { VerificationEvidence } from './ReportEvidence';
import type { ReportStatusView } from './ReportStatus';

/**
 * User-safe reason codes: unclear when the judge could not see the photo (retake it), not_waste
 * when the judge said so, unconfirmed for any other model rejection.
 */
export type RejectionReason = 'unclear' | 'not_waste' | 'unconfirmed';

// combiner.version suffix of the unusable-photo veto (decision 20261011-0230).
const UNCLEAR_VETO = '+judge_veto:unclear ';

export class ReportRejection {
  /** Null unless the models turned the photo down (issue 103); moderation and neighbour rejections are not theirs. */
  static reasonOf(view: ReportStatusView | null | undefined): RejectionReason | null {
    if (!view || !ReportRejection.#byModels(view)) return null;
    return ReportRejection.#reason(view.verification);
  }

  static #reason(verification: VerificationEvidence | null | undefined): RejectionReason {
    if (verification?.combiner?.version.includes(UNCLEAR_VETO)) return 'unclear';
    return verification?.judge?.report_type === 'not_waste' ? 'not_waste' : 'unconfirmed';
  }

  static #byModels({ status, moderation, verification }: ReportStatusView): boolean {
    return status === 'rejected' && moderation?.outcome !== 'rejected' && verification?.decision === 'rejected';
  }
}
