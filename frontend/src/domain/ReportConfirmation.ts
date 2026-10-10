import { RationaleSanitizer } from './RationaleSanitizer';
import type { ReportStatusView } from './ReportStatus';
import { REPORT_TYPES, type ReportType } from './ReportType';

/** expired: no answer within the window (contracts v1.16). */
export type ConfirmationAnswer = 'sure' | 'withdrawn' | 'expired';

/** GET /reports/{id} confirmation: the check was unsure, so the reporter is asked once whether they are sure. */
export interface ReportConfirmation {
  /** Plain English from the api; the app shows its own en or hi wording instead. */
  readonly question: string;
  readonly reasoning: string;
  readonly report_type: string;
  readonly asked_at: string;
  readonly expires_at: string;
  readonly answer: ConfirmationAnswer | null;
  readonly answered_at: string | null;
}

/** POST /reports/{id}/confirm body: nothing else is allowed. */
export interface ConfirmRequest {
  readonly sure: boolean;
}

export interface ConfirmationAskView {
  readonly reportId: string;
  /** The type to name in the question; null when no known type was claimed. */
  readonly reportType: ReportType | null;
  /** The judge's reason made safe to show; null when it failed the guard. */
  readonly reasoning: string | null;
}

const KNOWN_TYPES: ReadonlySet<string> = new Set(REPORT_TYPES);

/** The question a report waiting for its reporter's answer asks, built only from GET /reports/{id}. */
export class ConfirmationAsk {
  /** Null unless the report is needs_confirmation. */
  static of(view: ReportStatusView | null | undefined): ConfirmationAskView | null {
    if (view?.status !== 'needs_confirmation') return null;
    const type = view.confirmation?.report_type ?? view.report?.report_type;
    return {
      reportId: view.report_id,
      reportType: ConfirmationAsk.#known(type),
      reasoning: RationaleSanitizer.clean(view.confirmation?.reasoning),
    };
  }

  static #known(type: string | undefined): ReportType | null {
    return type !== undefined && KNOWN_TYPES.has(type) ? (type as ReportType) : null;
  }
}
