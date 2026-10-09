import { ApiError } from '../domain/ApiError';
import type { QueuedReport } from '../domain/QueuedReport';
import { ReportStatuses } from '../domain/ReportStatus';
import type { ReportApi } from './ReportApi';
import type { ReportQueue } from './ReportQueue';

// Activity refreshes at most this many open reports at once.
const MAX_REFRESH = 20;

/** Reads GET /reports/{id} for sent reports and keeps the latest status on the phone. */
export class ReportTracker {
  readonly #api: ReportApi;
  readonly #queue: ReportQueue;

  constructor(api: ReportApi, queue: ReportQueue) {
    this.#api = api;
    this.#queue = queue;
  }

  static isOpen(report: QueuedReport): boolean {
    const status = report.data.status?.status;
    return report.data.report_id !== null && (status === undefined || !ReportStatuses.isFinal(status));
  }

  /** Offline or not visible to this viewer: the last known status stays. */
  async refresh(id: string): Promise<void> {
    const reportId = this.#queue.find(id)?.data.report_id;
    if (!reportId) return;
    try {
      const status = await this.#api.status(reportId);
      const latest = this.#queue.find(id);
      if (latest) await this.#queue.save(latest.withStatus(status));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
  }

  async refreshOpen(): Promise<void> {
    await this.#queue.load();
    const open = this.#queue.snapshot().filter((report) => ReportTracker.isOpen(report));
    await Promise.all(open.slice(0, MAX_REFRESH).map((report) => this.refresh(report.id)));
  }
}
