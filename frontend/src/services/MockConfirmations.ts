import { ApiError } from '../domain/ApiError';
import type { ConfirmationAnswer, ReportConfirmation } from '../domain/ReportConfirmation';
import type { ReportStatus, ReportStatusView } from '../domain/ReportStatus';
import { isoSeconds } from '../domain/utils';
import type { ReportEvidenceLoader } from './reportFixtures';

// CONFIRM_TTL_HOURS (24): how long the reporter has to answer.
const WINDOW_MS = 24 * 60 * 60 * 1000;
const QUESTION = "Our check wasn't sure this shows a waste site. Only report it if you're 100% sure.";

const STATUS_AFTER: Readonly<Record<ConfirmationAnswer | 'none', ReportStatus>> = {
  none: 'needs_confirmation',
  sure: 'processing',
  withdrawn: 'withdrawn',
  expired: 'not_confirmed',
};

/**
 * Mock mode's reporter confirmation (contracts v1.16): every second report sent in a session is one the
 * check was unsure about, with the verification_result.jdh-confirm evidence.
 */
export class MockConfirmations {
  readonly #evidence: ReportEvidenceLoader;
  readonly #claims = new Map<string, string>();
  readonly #asked = new Map<string, ReportConfirmation>();
  #submitted = 0;

  constructor(evidence: ReportEvidenceLoader) {
    this.#evidence = evidence;
  }

  noteSubmitted(reportId: string, reportType: string): void {
    this.#submitted += 1;
    if (this.#submitted % 2 === 0) this.#claims.set(reportId, reportType);
  }

  /** The status once the checks are done; null when the mock does not ask this report or the reporter said sure. */
  async settled(reportId: string, now: Date): Promise<ReportStatusView | null> {
    const type = this.#claims.get(reportId);
    if (type === undefined) return null;
    const confirmation = this.#asked.get(reportId) ?? (await this.#ask(reportId, type, now));
    return confirmation.answer === 'sure' ? null : this.#view(reportId, confirmation, now);
  }

  /** The same answer again returns the same status; any other answer finds the question closed. */
  async answer(reportId: string, sure: boolean, now: Date): Promise<ReportStatusView> {
    const asked = this.#asked.get(reportId);
    const answer: ConfirmationAnswer = sure ? 'sure' : 'withdrawn';
    if (!asked || (asked.answer !== null && asked.answer !== answer)) {
      throw new ApiError(409, 'confirmation_closed', 'This report is no longer waiting for an answer.');
    }
    const confirmation = asked.answer === null ? { ...asked, answer, answered_at: isoSeconds(now) } : asked;
    this.#asked.set(reportId, confirmation);
    return this.#view(reportId, confirmation, now);
  }

  async #ask(reportId: string, type: string, now: Date): Promise<ReportConfirmation> {
    const { verification } = await this.#evidence();
    const asked: ReportConfirmation = {
      question: QUESTION,
      reasoning: verification.judge?.rationale ?? '',
      report_type: type,
      asked_at: isoSeconds(now),
      expires_at: isoSeconds(new Date(now.getTime() + WINDOW_MS)),
      answer: null,
      answered_at: null,
    };
    this.#asked.set(reportId, asked);
    return asked;
  }

  async #view(reportId: string, confirmation: ReportConfirmation, now: Date): Promise<ReportStatusView> {
    const set = await this.#evidence();
    const report = { ...set.report, report_type: confirmation.report_type };
    const status = STATUS_AFTER[confirmation.answer ?? 'none'];
    return { report_id: reportId, status, site_id: null, blurred_url: null, updated_at: isoSeconds(now), ...set, report, confirmation };
  }
}
