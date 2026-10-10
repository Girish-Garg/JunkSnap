import type { QueueItemData } from '../domain/QueueItem';
import type { QueuedReportData } from '../domain/QueuedReport';

/** The phone's own queued uploads, pending and sent. */
export interface ItemStore<Data extends QueueItemData> {
  all(): Promise<readonly Data[]>;
  get(id: string): Promise<Data | undefined>;
  put(item: Data): Promise<void>;
  delete(id: string): Promise<void>;
}

export type ReportStore = ItemStore<QueuedReportData>;

/** Small values that must outlive a reload, such as the device token. */
export interface MetaStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}
