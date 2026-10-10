import type { ReportStatusView } from './ReportStatus';

/** User-safe reason codes: not_waste when the judge said so, unconfirmed for any other model rejection. */
export type RejectionReason = 'not_waste' | 'unconfirmed';

export class ReportRejection {
  /** Null unless the models turned the photo down (issue 103); moderation and neighbour rejections are not theirs. */
  static reasonOf(view: ReportStatusView | null | undefined): RejectionReason | null {
    if (!view || !ReportRejection.#byModels(view)) return null;
    return view.verification?.judge?.report_type === 'not_waste' ? 'not_waste' : 'unconfirmed';
  }

  static #byModels({ status, moderation, verification }: ReportStatusView): boolean {
    return status === 'rejected' && moderation?.outcome !== 'rejected' && verification?.decision === 'rejected';
  }
}
