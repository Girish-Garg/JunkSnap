import type { QueuedReportData } from '../domain/QueuedReport';
import type { JunkSnapDb } from './JunkSnapDb';
import type { ReportStore } from './ReportStore';

export class IndexedDbReportStore implements ReportStore {
  readonly #db: JunkSnapDb;

  constructor(db: JunkSnapDb) {
    this.#db = db;
  }

  async all(): Promise<readonly QueuedReportData[]> {
    return (await this.#db.open()).getAll('reports');
  }

  async get(id: string): Promise<QueuedReportData | undefined> {
    return (await this.#db.open()).get('reports', id);
  }

  async put(report: QueuedReportData): Promise<void> {
    await (await this.#db.open()).put('reports', report);
  }

  async delete(id: string): Promise<void> {
    await (await this.#db.open()).delete('reports', id);
  }
}
