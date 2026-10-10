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

  async scores(kind: AreaKind, id: string): Promise<AreaScores> {
    const path = `/areas/${kind}/${encodeURIComponent(id)}/scores`;
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    } catch (cause) {
      throw HttpErrors.network(`Request to ${path}`, cause);
    }
    if (!response.ok) throw await HttpErrors.fromResponse(response);
    return (await response.json()) as AreaScores;
  }
}
