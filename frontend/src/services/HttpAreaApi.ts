import type { AreaListing } from '../domain/AreaListing';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import type { AreaApi } from './AreaApi';
import { HttpErrors } from './HttpErrors';

type Fetch = typeof fetch;

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

  list(kind: AreaKind, within: string, limit: number): Promise<AreaListing> {
    const query = new URLSearchParams({ within, limit: String(limit) });
    return this.#get<AreaListing>(`/areas/${kind}?${query.toString()}`);
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
