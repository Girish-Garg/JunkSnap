import type { SiteCollection, SiteFeature } from '../domain/Site';
import type { Clock } from './Clock';
import { ExpiringCache, type CachePolicy } from './ExpiringCache';
import type { SiteCacheEviction } from './SiteCacheEviction';

// Votes, withdrawals and cleanups change sites at any time, so every read asks again; a 304 keeps the copy.
// A tile can hold 500 sites, so fewer tiles than sites are kept.
const ALWAYS_ASK_TILES: CachePolicy = { ttlMs: 0, staleWhileRevalidate: false, maxEntries: 16 };
const ALWAYS_ASK_SITES: CachePolicy = { ...ALWAYS_ASK_TILES, maxEntries: 32 };

/** The copies of GET /sites?bbox (keyed by bbox) and GET /sites/{id} (keyed by site id) with their ETags. */
export class SiteCaches implements SiteCacheEviction {
  readonly boxes: ExpiringCache<SiteCollection>;
  readonly sites: ExpiringCache<SiteFeature>;

  constructor(boxes: ExpiringCache<SiteCollection>, sites: ExpiringCache<SiteFeature>) {
    this.boxes = boxes;
    this.sites = sites;
  }

  static standard(clock: Clock): SiteCaches {
    return new SiteCaches(new ExpiringCache(ALWAYS_ASK_TILES, clock), new ExpiringCache(ALWAYS_ASK_SITES, clock));
  }

  // Any tile may hold the site, so every tile goes.
  forgetSite(siteId: string): void {
    this.sites.forget(siteId);
    this.boxes.clear();
  }
}
