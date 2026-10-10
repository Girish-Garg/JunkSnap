export interface ReportQueue {
  sendReport(reportId: string): Promise<void>;
}
