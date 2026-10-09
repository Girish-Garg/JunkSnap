import type { AreaSite } from "../domain/AreaSite.js";

export interface UnreadableSite {
  readonly siteId: string;
  readonly error: Error;
}

export interface SiteRead {
  readonly sites: AreaSite[];
  // Items that break the site contract; the job logs and counts them instead of stopping every area.
  readonly unreadable: UnreadableSite[];
}

// Every site, rejected ones included, so an area whose sites were all rejected still gets zero counts.
export interface AreaSiteReader {
  readAll(): Promise<SiteRead>;
}
