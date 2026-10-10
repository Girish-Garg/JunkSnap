import type { ReportStatusView } from '../domain/ReportStatus';
import type { AcceptedReport, PresignRequest, PresignResponse, ReportUpload } from '../domain/ReportUpload';
import { HttpTransport } from './HttpTransport';
import type { ReportApi, RequestIdentity } from './ReportApi';

export class HttpReportApi implements ReportApi {
  readonly #http: HttpTransport;

  constructor(baseUrl: string, identity: RequestIdentity, fetchImpl?: typeof fetch) {
    this.#http = new HttpTransport(baseUrl, identity, fetchImpl);
  }

  presign(request: PresignRequest): Promise<PresignResponse> {
    return this.#http.post<PresignResponse>('/uploads/presign', request);
  }

  submit(upload: ReportUpload): Promise<AcceptedReport> {
    return this.#http.post<AcceptedReport>('/reports', upload);
  }

  /** The bearer token opens the user's report; the device token alone opens only an old guest report. */
  status(reportId: string): Promise<ReportStatusView> {
    return this.#http.json<ReportStatusView>(`/reports/${encodeURIComponent(reportId)}`, {});
  }

  putPhoto(upload: PresignResponse, photo: ArrayBuffer): Promise<void> {
    return this.#http.put(upload.upload_url, upload.headers, photo);
  }
}
