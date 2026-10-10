import { ApiError } from '../src/domain/ApiError';
import type { ReportStatusView } from '../src/domain/ReportStatus';
import type { AcceptedReport, PresignRequest, PresignResponse, ReportUpload } from '../src/domain/ReportUpload';
import type { ReportApi } from '../src/services/ReportApi';

type Call = 'presign' | 'put' | 'submit' | 'status';

/** Records every call; queue a failure for the next call of a kind with failNext. */
export class FakeReportApi implements ReportApi {
  readonly calls: { readonly kind: Call; readonly body?: unknown }[] = [];
  readonly #failures = new Map<Call, ApiError[]>();
  #presigns = 0;
  status_: ReportStatusView['status'] = 'processing';
  verification_: ReportStatusView['verification'] = undefined;

  failNext(kind: Call, status: number, code = 'error'): void {
    this.#failures.set(kind, [...(this.#failures.get(kind) ?? []), new ApiError(status, code, `${kind} failed`)]);
  }

  count(kind: Call): number {
    return this.calls.filter((call) => call.kind === kind).length;
  }

  bodies(kind: Call): unknown[] {
    return this.calls.filter((call) => call.kind === kind).map((call) => call.body);
  }

  async presign(request: PresignRequest): Promise<PresignResponse> {
    this.#record('presign', request);
    this.#presigns += 1;
    const uploadId = `upl_test_${this.#presigns}`;
    const headers = { 'Content-Type': 'image/jpeg', 'x-amz-checksum-sha256': 'abc=' };
    return { upload_id: uploadId, upload_url: `https://s3.test/reports/${uploadId}.jpg`, headers, expires_at: '2026-10-10T04:05:00Z' };
  }

  async putPhoto(upload: PresignResponse): Promise<void> {
    this.#record('put', upload.upload_id);
  }

  async submit(upload: ReportUpload): Promise<AcceptedReport> {
    this.#record('submit', upload);
    return { report_id: upload.upload_id.replace(/^upl_/, 'rpt_'), status: 'queued' };
  }

  async status(reportId: string): Promise<ReportStatusView> {
    this.#record('status', reportId);
    const blurred = this.status_ === 'verified' ? `https://cdn.test/media/reports/${reportId}.jpg` : null;
    const view = { report_id: reportId, status: this.status_, site_id: blurred ? 'site_test' : null, blurred_url: blurred, updated_at: '2026-10-10T04:01:00Z' };
    return this.verification_ === undefined ? view : { ...view, verification: this.verification_ };
  }

  #record(kind: Call, body: unknown): void {
    this.calls.push({ kind, body });
    const failure = this.#failures.get(kind)?.shift();
    if (failure) throw failure;
  }
}
