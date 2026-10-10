import type { QueuedScan } from '../../domain/QueuedScan';
import { REPORT_TYPES, type ReportType } from '../../domain/ReportType';
import type { FrameFinding } from '../../domain/ScanUpload';
import type { ProgressTone } from './ReportProgress';

export const SCAN_STEPS = ['saved', 'uploaded', 'sent', 'processed'] as const;

export interface ScanProgressView {
  /** Key under scan.progress.* in the i18n files. */
  readonly key: string;
  readonly tone: ProgressTone;
}

export interface FoundPart {
  readonly type: ReportType;
  readonly count: number;
}

/** What a finished video found: frames still being checked, sites by type, or nothing. */
export type ScanOutcome =
  | { readonly kind: 'checking'; readonly count: number }
  | { readonly kind: 'found'; readonly count: number; readonly parts: readonly FoundPart[] }
  | { readonly kind: 'nothing' };

const TONES: Readonly<Record<string, ProgressTone>> = { done: 'good', failed: 'alert', refused: 'alert', sign_in: 'alert' };

/** Display rules for one recording, from the phone to the sites its frames landed in. */
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

  /** Counts only frames the models passed, one per site; null before the worker is done. */
  static outcome(scan: QueuedScan): ScanOutcome | null {
    const found = scan.data.status?.status === 'done' ? scan.data.status.found : null;
    if (!found) return null;
    if (found.checking > 0) return { kind: 'checking', count: found.checking };
    if (found.sites === 0) return { kind: 'nothing' };
    const parts = REPORT_TYPES.flatMap((type) => {
      const count = found.by_type[type] ?? 0;
      return count > 0 ? [{ type, count }] : [];
    });
    return { kind: 'found', count: found.sites, parts };
  }

  /** Every frame the worker cut, in time order, with what became of it. */
  static frames(scan: QueuedScan): readonly FrameFinding[] {
    const status = scan.data.status;
    return status?.status === 'done' ? (status.found?.frames ?? []) : [];
  }

  static #key(scan: QueuedScan): string {
    const { stage, problem, status } = scan.data;
    if (stage === 'failed') return 'refused';
    if (problem) return problem;
    if (stage !== 'sent') return 'sending';
    return status?.status ?? 'queued';
  }
}
