import type { AreaCrawl } from '../domain/AreaCrawl';
import type { AreaListing } from '../domain/AreaListing';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import { ConditionalFetch } from './ConditionalFetch';
import type { Tagged } from './ExpiringCache';
import type { TaggedAreaApi } from './TaggedAreaApi';

type Fetch = typeof fetch;

/** Every route here is public, so no token is sent. */
export class HttpAreaApi implements TaggedAreaApi {
  readonly #http: ConditionalFetch;

  constructor(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.#http = new ConditionalFetch(baseUrl, fetchImpl);
  }

  async scores(kind: AreaKind, id: string): Promise<AreaScores> {
    return (await this.#http.get<AreaScores>(`/areas/${kind}/${encodeURIComponent(id)}/scores`, null)).value;
  }

  async list(kind: AreaKind, within: string, limit: number): Promise<AreaListing> {
    return (await this.listTagged(kind, within, limit, null)).value;
  }

  listTagged(kind: AreaKind, within: string, limit: number, previous: Tagged<AreaListing> | null): Promise<Tagged<AreaListing>> {
    const query = new URLSearchParams({ within, limit: String(limit) });
    return this.#http.get<AreaListing>(`/areas/${kind}?${query.toString()}`, previous);
  }

  async crawl(districtId: string): Promise<AreaCrawl> {
    return (await this.#http.get<AreaCrawl>(`/areas/district/${encodeURIComponent(districtId)}/crawl`, null)).value;
  }
}
