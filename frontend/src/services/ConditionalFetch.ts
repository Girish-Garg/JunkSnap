import type { Tagged } from './ExpiringCache';
import { HttpErrors } from './HttpErrors';
import { REQUEST_TIMEOUT_MS } from './HttpTransport';

type Fetch = typeof fetch;

const NOT_MODIFIED = 304;

/** GETs JSON with If-None-Match from the copy in hand: a 304 keeps that copy, a 200 brings the new body and its ETag. */
export class ConditionalFetch {
  readonly #baseUrl: string;
  readonly #fetch: Fetch;

  constructor(baseUrl: string, fetchImpl: Fetch) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#fetch = fetchImpl;
  }

  async get<T>(path: string, previous: Tagged<T> | null): Promise<Tagged<T>> {
    const response = await this.#send(path, previous?.token ?? null);
    if (response.status === NOT_MODIFIED && previous) {
      return { value: previous.value, token: response.headers.get('ETag') ?? previous.token };
    }
    if (!response.ok) throw await HttpErrors.fromResponse(response);
    return { value: (await response.json()) as T, token: response.headers.get('ETag') };
  }

  async #send(path: string, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['If-None-Match'] = token;
    try {
      // The same timeout as every other api call, so a hung read ends as a timeout (ErrorClassifier), not a spinner.
      return await this.#fetch(`${this.#baseUrl}${path}`, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (cause) {
      throw HttpErrors.network(`Request to ${path}`, cause);
    }
  }
}
