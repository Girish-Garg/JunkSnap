import { ApiError } from '../domain/ApiError';
import { HttpErrors } from './HttpErrors';
import type { RequestIdentity } from './ReportApi';

type Fetch = typeof fetch;

// A letter drafts for up to 60 s (contracts/README.md); past this the call is given up and said to have timed out.
export const REQUEST_TIMEOUT_MS = 75_000;

/** JSON calls to the api with the caller's tokens, and PUTs to presigned S3 URLs. */
export class HttpTransport {
  readonly #baseUrl: string;
  readonly #identity: RequestIdentity;
  readonly #fetch: Fetch;

  constructor(baseUrl: string, identity: RequestIdentity, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#identity = identity;
    this.#fetch = fetchImpl;
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.json<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  async json<T>(path: string, init: RequestInit): Promise<T> {
    const headers = { Accept: 'application/json', ...(await this.#identityHeaders()), ...init.headers };
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (cause) {
      throw HttpErrors.network(`Request to ${path}`, cause);
    }
    if (!response.ok) throw await HttpErrors.fromResponse(response);
    return (await response.json()) as T;
  }

  /** PUT with exactly the presigned headers; a 403 is a stale or mismatched signature that a fresh presign can fix. */
  async put(url: string, headers: Readonly<Record<string, string>>, body: ArrayBuffer): Promise<void> {
    let response: Response;
    try {
      response = await this.#fetch(url, { method: 'PUT', headers: { ...headers }, body });
    } catch (cause) {
      throw HttpErrors.network('Upload', cause);
    }
    if (response.status === 403) throw new ApiError(403, 'upload_refused', 'S3 refused the presigned upload');
    if (!response.ok) throw new ApiError(response.status, 'upload_failed', `S3 returned ${response.status}`);
  }

  // Every api call carries the device token too: rate limits and reputation count per device as well.
  async #identityHeaders(): Promise<Record<string, string>> {
    const token = await this.#identity.idToken();
    const device = { 'X-Device-Token': await this.#identity.deviceToken() };
    return token ? { ...device, Authorization: `Bearer ${token}` } : device;
  }
}
