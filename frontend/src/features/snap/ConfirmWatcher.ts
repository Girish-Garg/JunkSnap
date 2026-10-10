import type { QueuedReport } from '../../domain/QueuedReport';
import { ConfirmationAsk, type ConfirmationAskView } from '../../domain/ReportConfirmation';

/** Spots reports seen in this session that have just started waiting for the reporter's answer (contracts v1.16). */
export class ConfirmWatcher {
  readonly #watched = new Set<string>();

  /** The question when a watched report was just asked; reports already waiting when first seen never count. */
  asked(reports: readonly QueuedReport[]): ConfirmationAskView | null {
    let asked: ConfirmationAskView | null = null;
    for (const report of reports) {
      const ask = ConfirmationAsk.of(report.data.status);
      if (ask === null) this.#watched.add(report.id);
      else if (this.#watched.delete(report.id)) asked = ask;
    }
    return asked;
  }
}
