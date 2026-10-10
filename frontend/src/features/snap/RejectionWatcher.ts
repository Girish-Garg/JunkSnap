import type { QueuedReport } from '../../domain/QueuedReport';
import { ReportRejection, type RejectionReason } from '../../domain/ReportRejection';

/** Spots reports seen still open in this session that the models have just turned down. */
export class RejectionWatcher {
  readonly #watched = new Set<string>();

  /** The reason when a watched report was just turned down; reports already rejected when first seen never count. */
  turned(reports: readonly QueuedReport[]): RejectionReason | null {
    let turned: RejectionReason | null = null;
    for (const report of reports) {
      const status = report.data.status;
      const reason = ReportRejection.reasonOf(status);
      if (reason !== null && this.#watched.delete(report.id)) turned = reason;
      else if (reason === null && status?.status !== 'rejected') this.#watched.add(report.id);
    }
    return turned;
  }
}
