import type { QueuedScan } from '../../domain/QueuedScan';
import type { ProgressTone } from './ReportProgress';

export const SCAN_STEPS = ['saved', 'uploaded', 'sent', 'processed'] as const;

export interface ScanProgressView {
  /** Key under scan.progress.* in the i18n files. */
  readonly key: string;
  readonly tone: ProgressTone;
}

const TONES: Readonly<Record<string, ProgressTone>> = { done: 'good', failed: 'alert', refused: 'alert', sign_in: 'alert' };

/** Display rules for one recording, from the phone to the worker's frame reports. */
export class ScanProgress {
  static of(scan: QueuedScan): ScanProgressView {
    const key = ScanProgress.#key(scan);
    return { key, tone: TONES[key] ?? 'plain' };
  }

  static stepsDone(scan: QueuedScan): number {
    const { stage, status } = scan.data;
    if (stage !== 'sent') return stage === 'uploaded' ? 2 : 1;
    return status?.status === 'done' || status?.status === 'failed' ? 4 : 3;
  }

  /** "N reports from M frames" once the worker is done. */
  static result(scan: QueuedScan): { readonly count: number; readonly frames: number } | null {
    const status = scan.data.status;
    if (status?.status !== 'done') return null;
    return { count: status.report_ids.length, frames: status.frames?.sampled ?? 0 };
  }

  static #key(scan: QueuedScan): string {
    const { stage, problem, status } = scan.data;
    if (stage === 'failed') return 'refused';
    if (problem) return problem;
    if (stage !== 'sent') return 'sending';
    return status?.status ?? 'queued';
  }
}
