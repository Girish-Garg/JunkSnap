import type { QueuedScanData } from '../domain/QueuedScan';
import type { JunkSnapDb } from './JunkSnapDb';
import type { ItemStore } from './ReportStore';

export class IndexedDbScanStore implements ItemStore<QueuedScanData> {
  readonly #db: JunkSnapDb;

  constructor(db: JunkSnapDb) {
    this.#db = db;
  }

  async all(): Promise<readonly QueuedScanData[]> {
    return (await this.#db.open()).getAll('scans');
  }

  async get(id: string): Promise<QueuedScanData | undefined> {
    return (await this.#db.open()).get('scans', id);
  }

  async put(scan: QueuedScanData): Promise<void> {
    await (await this.#db.open()).put('scans', scan);
  }

  async delete(id: string): Promise<void> {
    await (await this.#db.open()).delete('scans', id);
  }
}
