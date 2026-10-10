import type { AreaCrawl } from '../domain/AreaCrawl';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import type { AreaApi } from './AreaApi';
import { HttpErrors } from './HttpErrors';

type Fetch = typeof fetch;

/** Both routes are public, so no token is sent. */
export class HttpAreaApi implements AreaApi {
  readonly #baseUrl: string;
  readonly #fetch: Fetch;

  constructor(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#fetch = fetchImpl;
  }

  scores(kind: AreaKind, id: string): Promise<AreaScores> {
    return this.#get<AreaScores>(`/areas/${kind}/${encodeURIComponent(id)}/scores`);
  }

  crawl(districtId: string): Promise<AreaCrawl> {
    return this.#get<AreaCrawl>(`/areas/district/${encodeURIComponent(districtId)}/crawl`);
  }

  async #get<T>(path: string): Promise<T> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    } catch (cause) {
      throw HttpErrors.network(`Request to ${path}`, cause);
    }
    if (!response.ok) throw await HttpErrors.fromResponse(response);
    return (await response.json()) as T;
  }
}
