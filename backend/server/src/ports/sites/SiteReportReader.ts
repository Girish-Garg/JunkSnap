import type { SiteReportRef } from "../../domain/sites/Withdrawal.js";

export interface SiteReportReader {
  // Every report row on the site (reports table, by-site index, all pages).
  forSite(siteId: string): Promise<SiteReportRef[]>;
}
