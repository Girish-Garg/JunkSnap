// The reports queue, as scans use it: kind scan from the api, kind report for each kept frame.
export interface ScanQueue {
  sendScan(scanId: string): Promise<void>;
  sendReport(reportId: string): Promise<void>;
}
