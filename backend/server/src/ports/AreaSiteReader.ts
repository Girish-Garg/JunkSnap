import type { AreaSite } from "../domain/AreaSite.js";

// Every site, rejected ones included, so an area whose sites were all rejected still gets zero counts.
export interface AreaSiteReader {
  readAll(): Promise<AreaSite[]>;
}
