import { ApiError } from '../domain/ApiError';
import type { BBox } from '../domain/BBox';
import type { SiteFeature } from '../domain/Site';
import { SiteListing } from '../domain/SiteListing';
import type { ApiClient } from './ApiClient';
import type { SiteFixtureLoaders } from './siteFixtures';

export class MockApiClient implements ApiClient {
  readonly #loaders: SiteFixtureLoaders;
  #sites: Promise<readonly SiteFeature[]> | null = null;

  constructor(loaders: SiteFixtureLoaders) {
    this.#loaders = loaders;
  }

  /** Mirrors the API: rejected, removed, cleaned and expired sites left out, newest first. */
  async listSites(bbox: BBox): Promise<readonly SiteFeature[]> {
    const sites = await this.#allSites();
    return sites.filter(
      (site) => SiteListing.onMap(site.properties) && bbox.contains(site.geometry.coordinates),
    );
  }

  async getSite(siteId: string): Promise<SiteFeature> {
    const sites = await this.#allSites();
    const site = sites.find((candidate) => candidate.properties.site_id === siteId);
    if (!site) throw new ApiError(404, 'not_found', `No site ${siteId}`);
    return site;
  }

  #allSites(): Promise<readonly SiteFeature[]> {
    this.#sites ??= Promise.all(Object.values(this.#loaders).map((load) => load())).then(
      (sites) => sites.sort((a, b) => b.properties.last_reported_at.localeCompare(a.properties.last_reported_at)),
    );
    return this.#sites;
  }
}
