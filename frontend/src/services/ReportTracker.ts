import { ApiError } from '../domain/ApiError';
import type { QueuedReport } from '../domain/QueuedReport';
import { ReportStatuses, type ReportStatusView } from '../domain/ReportStatus';
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
      await this.#queue.update(id, (latest) => latest.withStatus(status));
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    }
  }

  /**
   * Reads one of this user's reports by its server id, for the "What we checked" view; a photo row
   * on this phone keeps the fresh status too. GET /reports/{id} answers only the report's owner.
   */
  async read(reportId: string): Promise<ReportStatusView> {
    const status = await this.#api.status(reportId);
    const mine = this.#queue.snapshot().find((report) => report.data.report_id === reportId);
    if (mine) await this.#queue.update(mine.id, (latest) => latest.withStatus(status));
    return status;
  }

  /** The api withdrew these reports; Activity shows them as withdrawn at once, without another read. */
  async markWithdrawn(reportIds: readonly string[]): Promise<void> {
    const ids = new Set(reportIds);
    const mine = this.#queue.snapshot().filter((report) => report.data.report_id !== null && ids.has(report.data.report_id));
    await Promise.all(mine.map((report) => this.#queue.update(report.id, (latest) => latest.withdrawn())));
  }

  async refreshOpen(): Promise<void> {
    await this.#queue.load();
    const open = this.#queue.snapshot().filter((report) => ReportTracker.isOpen(report));
    await Promise.all(open.slice(0, MAX_REFRESH).map((report) => this.refresh(report.id)));
  }
}
