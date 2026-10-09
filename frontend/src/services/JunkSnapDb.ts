import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { QueuedReportData } from '../domain/QueuedReport';

interface JunkSnapSchema extends DBSchema {
  reports: { key: string; value: QueuedReportData };
  meta: { key: string; value: string };
}

export type JunkSnapDatabase = IDBPDatabase<JunkSnapSchema>;

const NAME = 'junksnap';
const VERSION = 1;

/** Opens the app's IndexedDB once; both stores share the connection. */
export class JunkSnapDb {
  #db: Promise<JunkSnapDatabase> | null = null;

  open(): Promise<JunkSnapDatabase> {
    this.#db ??= openDB<JunkSnapSchema>(NAME, VERSION, {
      upgrade(db) {
        db.createObjectStore('reports', { keyPath: 'id' });
        db.createObjectStore('meta');
      },
    });
    return this.#db;
  }
}
