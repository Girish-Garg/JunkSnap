import { ApiError } from '../src/domain/ApiError';
import type { BBox } from '../src/domain/BBox';
import type { SiteFeature } from '../src/domain/Site';
import { SiteListing } from '../src/domain/SiteListing';
import type { ApiClient } from '../src/services/ApiClient';

// Answers like GET /sites: only sites on the active map, inside the box.
export class ListApi implements ApiClient {
  readonly #sites: readonly SiteFeature[];

  constructor(sites: readonly SiteFeature[]) {
    this.#sites = sites;
  }

  async listSites(bbox: BBox): Promise<readonly SiteFeature[]> {
    return this.#sites.filter((site) => SiteListing.onMap(site.properties) && bbox.contains(site.geometry.coordinates));
  }

  async getSite(siteId: string): Promise<SiteFeature> {
    const site = this.#sites.find((item) => item.properties.site_id === siteId);
    if (!site) throw new ApiError(404, 'not_found', siteId);
    return site;
  }
}
