import { ApiError } from '../domain/ApiError';
import type { ReportStatusView } from '../domain/ReportStatus';
import type { AcceptedReport, PresignRequest, PresignResponse, ReportUpload } from '../domain/ReportUpload';
import { HttpErrors } from './HttpErrors';
import type { ReportApi, RequestIdentity } from './ReportApi';

type Fetch = typeof fetch;

export class HttpReportApi implements ReportApi {
  readonly #baseUrl: string;
  readonly #identity: RequestIdentity;
  readonly #fetch: Fetch;

  constructor(baseUrl: string, identity: RequestIdentity, fetchImpl: Fetch = (input, init) => fetch(input, init)) {
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#identity = identity;
    this.#fetch = fetchImpl;
  }

  presign(request: PresignRequest): Promise<PresignResponse> {
    return this.#post<PresignResponse>('/uploads/presign', request);
  }

  submit(upload: ReportUpload): Promise<AcceptedReport> {
    return this.#post<AcceptedReport>('/reports', upload);
  }

  /** The bearer token opens the user's report; the device token alone opens only an old guest report. */
  status(reportId: string): Promise<ReportStatusView> {
    return this.#json<ReportStatusView>(`/reports/${encodeURIComponent(reportId)}`, {});
  }

  async putPhoto(upload: PresignResponse, photo: ArrayBuffer): Promise<void> {
    let response: Response;
    try {
      response = await this.#fetch(upload.upload_url, { method: 'PUT', headers: { ...upload.headers }, body: photo });
    } catch (cause) {
      throw HttpErrors.network('Photo upload', cause);
    }
    // 403 is an expired or mismatched signature, so a fresh presign can fix it.
    if (response.status === 403) throw new ApiError(403, 'upload_refused', 'S3 refused the presigned upload');
    if (!response.ok) throw new ApiError(response.status, 'upload_failed', `S3 returned ${response.status}`);
  }

  #post<T>(path: string, body: unknown): Promise<T> {
    return this.#json<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  async #json<T>(path: string, init: RequestInit): Promise<T> {
    const headers = { Accept: 'application/json', ...(await this.#identityHeaders()), ...init.headers };
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, { ...init, headers });
    } catch (cause) {
      throw HttpErrors.network(`Request to ${path}`, cause);
    }
    if (!response.ok) throw await HttpErrors.fromResponse(response);
    return (await response.json()) as T;
  }

  // Every api call carries the device token too: rate limits and reputation count per device as well.
  async #identityHeaders(): Promise<Record<string, string>> {
    const token = await this.#identity.idToken();
    const device = { 'X-Device-Token': await this.#identity.deviceToken() };
    return token ? { ...device, Authorization: `Bearer ${token}` } : device;
  }
}
