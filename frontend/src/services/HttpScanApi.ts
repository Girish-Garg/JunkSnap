import type { AcceptedScan, ScanPresignRequest, ScanPresignResponse, ScanSession, ScanStatusView } from '../domain/ScanUpload';
import { HttpTransport, type HttpTimeouts } from './HttpTransport';
import type { RequestIdentity } from './ReportApi';
import type { ScanApi } from './ScanApi';

export class HttpScanApi implements ScanApi {
  readonly #http: HttpTransport;

  constructor(baseUrl: string, identity: RequestIdentity, fetchImpl?: typeof fetch, timeouts?: HttpTimeouts) {
    this.#http = new HttpTransport(baseUrl, identity, fetchImpl, timeouts);
  }

  presign(request: ScanPresignRequest): Promise<ScanPresignResponse> {
    return this.#http.post<ScanPresignResponse>('/scans/presign', request);
  }

  putVideo(upload: ScanPresignResponse, video: ArrayBuffer): Promise<void> {
    return this.#http.put(upload.upload_url, upload.headers, video);
  }

  submit(session: ScanSession): Promise<AcceptedScan> {
    return this.#http.post<AcceptedScan>('/scans', session);
  }

  status(scanId: string): Promise<ScanStatusView> {
    return this.#http.json<ScanStatusView>(`/scans/${encodeURIComponent(scanId)}`, {});
  }
}
