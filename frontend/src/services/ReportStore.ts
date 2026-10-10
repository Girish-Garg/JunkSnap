import type { QueuedReportData } from '../domain/QueuedReport';

/** The phone's own reports, pending and sent. */
export interface ReportStore {
  all(): Promise<readonly QueuedReportData[]>;
  get(id: string): Promise<QueuedReportData | undefined>;
  put(report: QueuedReportData): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Small values that must outlive a reload, such as the device token. */
export interface MetaStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}
