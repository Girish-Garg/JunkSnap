import type { QueuedReport } from '../../domain/QueuedReport';
import { ReportProgress } from '../snap/ReportProgress';

// Progress keys about checking a photo for waste, which a no-bin report never gets (decision 20261010-1630).
const PHOTO_KEYS: ReadonlySet<string> = new Set(['processing', 'unclear', 'not_waste', 'unconfirmed']);

/** What one Activity row offers: a no-bin report shows no photo check and no "What we checked". */
export class ActivityRow {
  static isNoBin(report: QueuedReport): boolean {
    return report.data.draft.report_type === 'no_bin';
  }

  static showsProgress(report: QueuedReport): boolean {
    return !ActivityRow.isNoBin(report) || !PHOTO_KEYS.has(ReportProgress.of(report).key);
  }
}
