import type { BBox } from '../domain/BBox';
import type { SiteCollection, SiteFeature } from '../domain/Site';
import type { ApiClient } from './ApiClient';
import type { Clock } from './Clock';
import { ConditionalFetch } from './ConditionalFetch';
import { ExpiringCache, type CachePolicy } from './ExpiringCache';
import { SystemClock } from './SystemClock';

type Fetch = typeof fetch;

/** The copies of GET /sites?bbox and GET /sites/{id} with their ETags. */
export interface SiteCaches {
  readonly boxes: ExpiringCache<SiteCollection>;
  readonly sites: ExpiringCache<SiteFeature>;
}

// Votes, withdrawals and cleanups change sites at any time, so every read asks again; a 304 keeps the copy.
// A tile can hold 500 sites, so fewer tiles than sites are kept.
const ALWAYS_ASK_TILES: CachePolicy = { ttlMs: 0, staleWhileRevalidate: false, maxEntries: 16 };
const ALWAYS_ASK_SITES: CachePolicy = { ...ALWAYS_ASK_TILES, maxEntries: 32 };

export class HttpApiClient implements ApiClient {
  readonly #http: ConditionalFetch;
  readonly #caches: SiteCaches;

  constructor(
    baseUrl: string,
    fetchImpl: Fetch = (input, init) => fetch(input, init),
    caches: SiteCaches = HttpApiClient.caches(new SystemClock()),
  ) {
    this.#http = new ConditionalFetch(baseUrl, fetchImpl);
    this.#caches = caches;
  }

  static caches(clock: Clock): SiteCaches {
    return { boxes: new ExpiringCache(ALWAYS_ASK_TILES, clock), sites: new ExpiringCache(ALWAYS_ASK_SITES, clock) };
  }

  async listSites(bbox: BBox): Promise<readonly SiteFeature[]> {
    const body = await this.#get(this.#caches.boxes, `/sites?bbox=${bbox.toQuery()}`);
    return body.features;
  }

  getSite(siteId: string): Promise<SiteFeature> {
    return this.#get(this.#caches.sites, `/sites/${encodeURIComponent(siteId)}`);
  }

  // A failed refresh still rejects, so the map says it could not load; the cache keeps the old copy for the next 304.
  async #get<T>(cache: ExpiringCache<T>, path: string): Promise<T> {
    const read = await cache.read({ key: path, load: (previous) => this.#http.get<T>(path, previous) });
    if (read.error !== null) throw read.error;
    return read.value;
  }
}
