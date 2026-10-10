import type { AreaCrawl } from '../domain/AreaCrawl';
import type { AreaListing } from '../domain/AreaListing';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import type { AreaApi } from './AreaApi';

interface Entry {
  readonly at: number;
  readonly listing: Promise<AreaListing>;
}

// The scores CronJob rewrites the rows every few minutes; a listing younger than this is reused.
const LIST_TTL_MS = 5 * 60 * 1000;

/**
 * Remembers GET /areas/{kind}?within= per kind, area and limit, so the map fill, the Areas tab and the ranking
 * share one request each instead of asking again on every open. A failed request is forgotten at once.
 */
export class CachedAreaApi implements AreaApi {
  readonly #inner: AreaApi;
  readonly #now: () => number;
  readonly #lists = new Map<string, Entry>();

  constructor(inner: AreaApi, now: () => number = () => Date.now()) {
    this.#inner = inner;
    this.#now = now;
  }

  scores(kind: AreaKind, id: string): Promise<AreaScores> {
    return this.#inner.scores(kind, id);
  }

  list(kind: AreaKind, within: string, limit: number): Promise<AreaListing> {
    const key = `${kind}|${within}|${String(limit)}`;
    const cached = this.#lists.get(key);
    if (cached && this.#now() - cached.at < LIST_TTL_MS) return cached.listing;
    const listing = this.#inner.list(kind, within, limit);
    this.#lists.set(key, { at: this.#now(), listing });
    listing.catch(() => {
      if (this.#lists.get(key)?.listing === listing) this.#lists.delete(key);
    });
    return listing;
  }

  crawl(districtId: string): Promise<AreaCrawl> {
    return this.#inner.crawl(districtId);
  }
}
