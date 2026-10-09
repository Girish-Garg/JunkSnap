import type { BBox } from '../domain/BBox';
import type { SiteFeature } from '../domain/Site';

export interface ApiClient {
  /** bbox at most 1 by 1 degree. */
  listSites(bbox: BBox): Promise<readonly SiteFeature[]>;
  /** Rejects with ApiError code not_found. */
  getSite(siteId: string): Promise<SiteFeature>;
}
