import { ApiError } from '../domain/ApiError';
import type { BBox } from '../domain/BBox';
import type { SiteCollection, SiteFeature } from '../domain/Site';
import type { ApiClient } from './ApiClient';

type Fetch = typeof fetch;

interface ErrorBody {
  readonly error?: string;
  readonly message?: string;
}

// Untested against a real server until the API exists.
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
    if (!response.ok) throw await this.#errorFrom(response);
    return (await response.json()) as T;
  }

  async #send(path: string): Promise<Response> {
    try {
      return await this.#fetch(`${this.#baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    } catch (cause) {
      throw new ApiError(0, 'network_error', `Request to ${path} failed: ${String(cause)}`);
    }
  }

  async #errorFrom(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    return new ApiError(response.status, body.error ?? 'server_error', body.message ?? response.statusText);
  }
}
