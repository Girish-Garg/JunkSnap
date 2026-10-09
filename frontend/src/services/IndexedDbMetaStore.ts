import type { JunkSnapDb } from './JunkSnapDb';
import type { MetaStore } from './ReportStore';

export class IndexedDbMetaStore implements MetaStore {
  readonly #db: JunkSnapDb;

  constructor(db: JunkSnapDb) {
    this.#db = db;
  }

  async get(key: string): Promise<string | undefined> {
    return (await this.#db.open()).get('meta', key);
  }

  async set(key: string, value: string): Promise<void> {
    await (await this.#db.open()).put('meta', value, key);
  }
}
