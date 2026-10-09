import type { BBox } from '../domain/BBox';
import type { SiteCollection, SiteFeature } from '../domain/Site';
import type { ApiClient } from './ApiClient';
import { HttpErrors } from './HttpErrors';

type Fetch = typeof fetch;

export class HttpApiClient implements ApiClient {
  readonly #baseUrl: string;
  readonly #fetch: Fetch;

  constructor(baseUrl: string, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#fetch = fetchImpl;
  }

  async listSites(bbox: BBox): Promise<readonly SiteFeature[]> {
    const body = await this.#get<SiteCollection>(`/sites?bbox=${bbox.toQuery()}`);
    return body.features;
  }

  getSite(siteId: string): Promise<SiteFeature> {
    return this.#get<SiteFeature>(`/sites/${encodeURIComponent(siteId)}`);
  }

  async #get<T>(path: string): Promise<T> {
    const response = await this.#send(path);
    if (!response.ok) throw await HttpErrors.fromResponse(response);
    return (await response.json()) as T;
  }

  async #send(path: string): Promise<Response> {
    try {
      return await this.#fetch(`${this.#baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    } catch (cause) {
      throw HttpErrors.network(`Request to ${path}`, cause);
    }
  }
}
