import type { BBox } from '../domain/BBox';
import type { SiteFeature } from '../domain/Site';
import type { ApiClient } from './ApiClient';
import { ConditionalFetch } from './ConditionalFetch';
import type { ExpiringCache } from './ExpiringCache';
import { SiteCaches } from './SiteCaches';
import { SystemClock } from './SystemClock';

type Fetch = typeof fetch;

export class HttpApiClient implements ApiClient {
  readonly #http: ConditionalFetch;
  readonly #caches: SiteCaches;

  constructor(
    baseUrl: string,
    fetchImpl: Fetch = (input, init) => fetch(input, init),
    caches: SiteCaches = SiteCaches.standard(new SystemClock()),
    timeoutMs?: number,
  ) {
    this.#http = new ConditionalFetch(baseUrl, fetchImpl, timeoutMs);
    this.#caches = caches;
  }

  async listSites(bbox: BBox): Promise<readonly SiteFeature[]> {
    const query = bbox.toQuery();
    const body = await this.#get(this.#caches.boxes, query, `/sites?bbox=${query}`);
    return body.features;
  }

  getSite(siteId: string): Promise<SiteFeature> {
    return this.#get(this.#caches.sites, siteId, `/sites/${encodeURIComponent(siteId)}`);
  }

  // A failed refresh still rejects, so the map says it could not load; the cache keeps the old copy for the next 304.
  async #get<T>(cache: ExpiringCache<T>, key: string, path: string): Promise<T> {
    const read = await cache.read({ key, load: (previous) => this.#http.get<T>(path, previous) });
    if (read.error !== null) throw read.error;
    return read.value;
  }
}
