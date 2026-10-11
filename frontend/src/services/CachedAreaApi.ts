import { CACHE_DEFAULTS, type CacheSettings } from '../config/CacheSettings';
import type { AreaCrawl } from '../domain/AreaCrawl';
import type { AreaListing } from '../domain/AreaListing';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import type { AreaApi } from './AreaApi';
import type { CachePolicy, ExpiringCache } from './ExpiringCache';
import type { TaggedAreaApi } from './TaggedAreaApi';

/**
 * Remembers GET /areas/{kind}?within= per kind, area and limit, so the map fill, the Areas tab and the ranking
 * share one request each. An older listing waits for a check with its ETag (a 304 keeps it); a failed request
 * rejects, and a failed first request is not kept, so the next open tries again.
 */
export class CachedAreaApi implements AreaApi {
  /** The scores CronJob rewrites the rows every 15 minutes; a listing younger than areaListTtlMs (5 min) is reused as is. */
  static policy(settings: Pick<CacheSettings, 'areaListTtlMs' | 'areaListEntries'> = CACHE_DEFAULTS): CachePolicy {
    return { ttlMs: settings.areaListTtlMs, staleWhileRevalidate: false, maxEntries: settings.areaListEntries };
  }

  readonly #inner: TaggedAreaApi;
  readonly #lists: ExpiringCache<AreaListing>;

  constructor(inner: TaggedAreaApi, lists: ExpiringCache<AreaListing>) {
    this.#inner = inner;
    this.#lists = lists;
  }

  scores(kind: AreaKind, id: string): Promise<AreaScores> {
    return this.#inner.scores(kind, id);
  }

  // A failed refresh rejects, so the screen shows the error; the old copy stays for the next 304.
  async list(kind: AreaKind, within: string, limit: number): Promise<AreaListing> {
    const read = await this.#lists.read({
      key: `${kind}|${within}|${String(limit)}`,
      load: (previous) => this.#inner.listTagged(kind, within, limit, previous),
    });
    if (read.error !== null) throw read.error;
    return read.value;
  }

  crawl(districtId: string): Promise<AreaCrawl> {
    return this.#inner.crawl(districtId);
  }
}
