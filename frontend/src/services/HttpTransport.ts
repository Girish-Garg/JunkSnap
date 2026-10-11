import { NETWORK_DEFAULTS, type NetworkSettings } from '../config/NetworkSettings';
import { ApiError } from '../domain/ApiError';
import { HttpErrors } from './HttpErrors';
import type { RequestIdentity } from './ReportApi';

type Fetch = typeof fetch;

/**
 * The config's network timeouts. A letter drafts for up to 60 s (contracts/README.md); past requestTimeoutMs the call
 * is given up and said to have timed out. A presigned PUT gets 30 s plus 1 s per 50 KiB (a weak 400 kbit/s uplink), at
 * most 15 min (a 40 MB video needs about 14); then it ends as a timeout and the queue backs off, instead of one stalled
 * upload holding the queue and its lock.
 */
export type HttpTimeouts = Pick<NetworkSettings, 'requestTimeoutMs' | 'putBaseTimeoutMs' | 'putMsPerChunk' | 'putChunkBytes' | 'putMaxTimeoutMs'>;

/** JSON calls to the api with the caller's tokens, and PUTs to presigned S3 URLs. */
export class HttpTransport {
  readonly #baseUrl: string;
  readonly #identity: RequestIdentity;
  readonly #fetch: Fetch;
  readonly #timeouts: HttpTimeouts;

  constructor(baseUrl: string, identity: RequestIdentity, fetchImpl: Fetch = (input, init) => fetch(input, init), timeouts: HttpTimeouts = NETWORK_DEFAULTS) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#identity = identity;
    this.#fetch = fetchImpl;
    this.#timeouts = timeouts;
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.json<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  async json<T>(path: string, init: RequestInit): Promise<T> {
    const headers = { Accept: 'application/json', ...(await this.#identityHeaders()), ...init.headers };
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(this.#timeouts.requestTimeoutMs) });
    } catch (cause) {
      throw HttpErrors.network(`Request to ${path}`, cause);
    }
    if (!response.ok) throw await HttpErrors.fromResponse(response);
    return (await response.json()) as T;
  }

  /** How long a PUT of this many bytes may take before it is given up as a timeout. */
  static putTimeoutMs(bytes: number, timeouts: HttpTimeouts = NETWORK_DEFAULTS): number {
    const { putBaseTimeoutMs, putChunkBytes, putMsPerChunk, putMaxTimeoutMs } = timeouts;
    return Math.min(putBaseTimeoutMs + Math.ceil(bytes / putChunkBytes) * putMsPerChunk, putMaxTimeoutMs);
  }

  /** PUT with exactly the presigned headers; a 403 is a stale or mismatched signature that a fresh presign can fix. */
  async put(url: string, headers: Readonly<Record<string, string>>, body: ArrayBuffer): Promise<void> {
    let response: Response;
    try {
      const signal = AbortSignal.timeout(HttpTransport.putTimeoutMs(body.byteLength, this.#timeouts));
      response = await this.#fetch(url, { method: 'PUT', headers: { ...headers }, body, signal });
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
