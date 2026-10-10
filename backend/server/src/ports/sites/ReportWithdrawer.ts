export interface ReportWithdrawer {
  // Sets status withdrawn on settled, unverified or rejected reports; a report already withdrawn stays as it is.
  markWithdrawn(reportIds: readonly string[], at: string): Promise<void>;
}
