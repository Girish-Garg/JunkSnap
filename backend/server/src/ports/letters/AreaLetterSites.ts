import type { AreaKey } from "../../domain/AreaKey.js";
import type { StoredAreaSite } from "../../domain/letters/AreaIssueSites.js";

export interface AreaSiteBatch {
  readonly sites: readonly StoredAreaSite[];
  // Items that break the site contract are skipped and counted, so one bad row does not block an area's letter.
  readonly unreadable: number;
}

export interface AreaLetterSites {
  sitesIn(area: AreaKey): Promise<AreaSiteBatch>;
}
