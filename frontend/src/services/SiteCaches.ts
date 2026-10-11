import { CACHE_DEFAULTS, type CacheSettings } from '../config/CacheSettings';
import type { SiteCollection, SiteFeature } from '../domain/Site';
import type { Clock } from './Clock';
import { ExpiringCache, type CachePolicy } from './ExpiringCache';
import type { SiteCacheEviction } from './SiteCacheEviction';

/** How many copies are kept (the config's cache settings); a tile can hold 500 sites, so fewer tiles than sites. */
export type SiteCacheSizes = Pick<CacheSettings, 'siteTileEntries' | 'siteEntries'>;

// Votes, withdrawals and cleanups change sites at any time, so every read asks again; a 304 keeps the copy.
const alwaysAsk = (maxEntries: number): CachePolicy => ({ ttlMs: 0, staleWhileRevalidate: false, maxEntries });

/** The copies of GET /sites?bbox (keyed by bbox) and GET /sites/{id} (keyed by site id) with their ETags. */
export class SiteCaches implements SiteCacheEviction {
  readonly boxes: ExpiringCache<SiteCollection>;
  readonly sites: ExpiringCache<SiteFeature>;

  constructor(boxes: ExpiringCache<SiteCollection>, sites: ExpiringCache<SiteFeature>) {
    this.boxes = boxes;
    this.sites = sites;
  }

  static standard(clock: Clock, sizes: SiteCacheSizes = CACHE_DEFAULTS): SiteCaches {
    return new SiteCaches(new ExpiringCache(alwaysAsk(sizes.siteTileEntries), clock), new ExpiringCache(alwaysAsk(sizes.siteEntries), clock));
  }

  // Any tile may hold the site, so every tile goes.
  forgetSite(siteId: string): void {
    this.sites.forget(siteId);
    this.boxes.clear();
  }
}
