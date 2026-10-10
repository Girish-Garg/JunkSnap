import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { QueuedReportData } from '../domain/QueuedReport';
import type { QueuedScanData } from '../domain/QueuedScan';

interface JunkSnapSchema extends DBSchema {
  reports: { key: string; value: QueuedReportData };
  scans: { key: string; value: QueuedScanData };
  meta: { key: string; value: string };
}

export type JunkSnapDatabase = IDBPDatabase<JunkSnapSchema>;

const NAME = 'junksnap';
// Version 2 adds the scans store; phones on version 1 keep their queued reports.
const VERSION = 2;

/** Opens the app's IndexedDB once; every store shares the connection. */
export class JunkSnapDb {
  #db: Promise<JunkSnapDatabase> | null = null;

  open(): Promise<JunkSnapDatabase> {
    this.#db ??= openDB<JunkSnapSchema>(NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('reports')) db.createObjectStore('reports', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('scans')) db.createObjectStore('scans', { keyPath: 'id' });
      },
    });
    return this.#db;
  }
}
