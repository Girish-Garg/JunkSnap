export interface AreaReportReader {
  // captured_at of the site's verified reports, epoch ms.
  verifiedReportTimes(siteId: string): Promise<number[]>;
}
