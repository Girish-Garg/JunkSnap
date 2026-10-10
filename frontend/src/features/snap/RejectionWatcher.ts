import type { QueuedReport } from '../../domain/QueuedReport';
import { ReportRejection } from '../../domain/ReportRejection';

/** Spots reports seen still open in this session that have just come back as not waste. */
export class RejectionWatcher {
  readonly #watched = new Set<string>();

  /** True when a watched report was just turned down; reports already rejected when first seen never count. */
  turned(reports: readonly QueuedReport[]): boolean {
    let turned = false;
    for (const report of reports) {
      const status = report.data.status;
      if (ReportRejection.reasonOf(status) !== null) turned = this.#watched.delete(report.id) || turned;
      else if (status?.status !== 'rejected') this.#watched.add(report.id);
    }
    return turned;
  }
}
