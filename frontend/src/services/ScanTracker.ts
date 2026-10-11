import { ApiError } from '../domain/ApiError';
import { AuthError } from '../domain/AuthError';
import type { QueuedScan } from '../domain/QueuedScan';
import type { ScanApi } from './ScanApi';
import type { ScanQueue } from './ScanQueue';

const MAX_REFRESH = 10;

/** Reads GET /scans/{id} for posted scans and keeps the latest status on the phone. */
export class ScanTracker {
  readonly #api: ScanApi;
  readonly #queue: ScanQueue;

  constructor(api: ScanApi, queue: ScanQueue) {
    this.#api = api;
    this.#queue = queue;
  }

  /** Posted, and the worker has not finished with it or its frames are still being checked. */
  static isOpen(scan: QueuedScan): boolean {
    const status = scan.data.status;
    if (scan.data.scan_id === null) return false;
    if (status?.status === 'done') return (status.found?.checking ?? 0) > 0;
    return status?.status !== 'failed';
  }

  async refresh(id: string): Promise<void> {
    const scanId = this.#queue.find(id)?.data.scan_id;
    if (!scanId) return;
    try {
      const status = await this.#api.status(scanId);
      await this.#queue.update(id, (latest) => latest.withStatus(status));
    } catch (error) {
      // Offline with a sign-in that cannot be refreshed (AuthError) is no different from offline.
      if (!(error instanceof ApiError || error instanceof AuthError)) throw error;
    }
  }

  async refreshOpen(): Promise<void> {
    await this.#queue.load();
    const open = this.#queue.snapshot().filter((scan) => ScanTracker.isOpen(scan));
    await Promise.all(open.slice(0, MAX_REFRESH).map((scan) => this.refresh(scan.id)));
  }
}
