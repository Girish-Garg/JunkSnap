import type { ConfirmRequest } from '../domain/ReportConfirmation';
import type { ReportListPage } from '../domain/ReportList';
import type { ReportStatusView } from '../domain/ReportStatus';
import type { AcceptedReport, NoBinUpload, PresignRequest, PresignResponse, ReportUpload } from '../domain/ReportUpload';
import { HttpTransport, type HttpTimeouts } from './HttpTransport';
import type { ReportApi, RequestIdentity } from './ReportApi';

export class HttpReportApi implements ReportApi {
  readonly #http: HttpTransport;

  constructor(baseUrl: string, identity: RequestIdentity, fetchImpl?: typeof fetch, timeouts?: HttpTimeouts) {
    this.#http = new HttpTransport(baseUrl, identity, fetchImpl, timeouts);
  }

  presign(request: PresignRequest): Promise<PresignResponse> {
    return this.#http.post<PresignResponse>('/uploads/presign', request);
  }

  submit(upload: ReportUpload | NoBinUpload): Promise<AcceptedReport> {
    return this.#http.post<AcceptedReport>('/reports', upload);
  }

  /** The bearer token opens the user's report; the device token alone opens only an old guest report. */
  status(reportId: string): Promise<ReportStatusView> {
    return this.#http.json<ReportStatusView>(`/reports/${encodeURIComponent(reportId)}`, {});
  }

  /** Owner only, with the bearer and device tokens like every api call. */
  confirm(reportId: string, request: ConfirmRequest): Promise<ReportStatusView> {
    return this.#http.post<ReportStatusView>(`/reports/${encodeURIComponent(reportId)}/confirm`, { sure: request.sure });
  }

  mine(cursor: string | null): Promise<ReportListPage> {
    const query = new URLSearchParams({ limit: '50', ...(cursor === null ? {} : { cursor }) });
    return this.#http.json<ReportListPage>(`/me/reports?${query.toString()}`, {});
  }

  putPhoto(upload: PresignResponse, photo: ArrayBuffer): Promise<void> {
    return this.#http.put(upload.upload_url, upload.headers, photo);
  }
}
