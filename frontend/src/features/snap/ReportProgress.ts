import type { QueuedReport } from '../../domain/QueuedReport';
import { ReportStatuses } from '../../domain/ReportStatus';

export type ProgressTone = 'plain' | 'good' | 'alert';

export interface ProgressView {
  /** Key under progress.* in the i18n files. */
  readonly key: string;
  readonly tone: ProgressTone;
}

const TONES: Readonly<Record<string, ProgressTone>> = {
  verified: 'good',
  rejected: 'alert',
  refused: 'alert',
  sign_in: 'alert',
};

/** Steps shown after Send: saved, uploaded, sent, checked. */
export const PROGRESS_STEPS = ['saved', 'uploaded', 'sent', 'checked'] as const;

/** Display rules for one report's journey from the phone to a checked status. */
export class ReportProgress {
  static of(report: QueuedReport): ProgressView {
    const key = ReportProgress.#key(report);
    return { key, tone: TONES[key] ?? 'plain' };
  }

  /** How many PROGRESS_STEPS are done. */
  static stepsDone(report: QueuedReport): number {
    const { stage, status } = report.data;
    if (stage !== 'sent') return stage === 'uploaded' ? 2 : 1;
    return status && !ReportStatuses.inPipeline(status.status) ? 4 : 3;
  }

  /** Sent, and the server has not finished its checks yet. */
  static isChecking(report: QueuedReport): boolean {
    const status = report.data.status?.status;
    return report.data.stage === 'sent' && (status === undefined || ReportStatuses.inPipeline(status));
  }

  static #key(report: QueuedReport): string {
    const { stage, problem, status } = report.data;
    if (stage === 'failed') return 'refused';
    if (problem) return problem;
    if (stage !== 'sent') return 'sending';
    return status?.status ?? 'queued';
  }
}
