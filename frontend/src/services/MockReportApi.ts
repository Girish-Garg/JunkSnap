import type { ReportStatus, ReportStatusView } from '../domain/ReportStatus';
import type { AcceptedReport, PresignRequest, PresignResponse, ReportUpload } from '../domain/ReportUpload';
import type { SiteFeature } from '../domain/Site';
import { isoSeconds } from '../domain/utils';
import type { ReportApi } from './ReportApi';

// Each poll moves a sample report one step; the last step joins it to the jdh-1 sample site.
const STEPS: readonly ReportStatus[] = ['queued', 'processing', 'verified'];

/** Mock mode: nothing leaves the phone. */
export class MockReportApi implements ReportApi {
  readonly #sampleSite: () => Promise<SiteFeature>;
  readonly #delayMs: number;
  readonly #polls = new Map<string, number>();
  #count = 0;

  constructor(sampleSite: () => Promise<SiteFeature>, delayMs = 400) {
    this.#sampleSite = sampleSite;
    this.#delayMs = delayMs;
  }

  async presign(request: PresignRequest): Promise<PresignResponse> {
    await this.#wait();
    this.#count += 1;
    const uploadId = `upl_sample_${Date.now().toString(36)}_${this.#count}`;
    const headers = { 'Content-Type': request.content_type, 'x-amz-checksum-sha256': 'sample' };
    const expires = new Date(Date.now() + 300_000);
    return { upload_id: uploadId, upload_url: `sample://reports/${uploadId}.jpg`, headers, expires_at: isoSeconds(expires) };
  }

  async putPhoto(): Promise<void> {
    await this.#wait();
  }

  async submit(upload: ReportUpload): Promise<AcceptedReport> {
    await this.#wait();
    return { report_id: upload.upload_id.replace(/^upl_/, 'rpt_'), status: 'queued' };
  }

  async status(reportId: string): Promise<ReportStatusView> {
    await this.#wait();
    const poll = this.#polls.get(reportId) ?? 0;
    this.#polls.set(reportId, poll + 1);
    const status = STEPS[Math.min(poll, STEPS.length - 1)] ?? 'queued';
    const updated_at = isoSeconds(new Date());
    if (status !== 'verified') return { report_id: reportId, status, site_id: null, blurred_url: null, updated_at };
    const site = (await this.#sampleSite()).properties;
    return { report_id: reportId, status, site_id: site.site_id, blurred_url: site.photo_urls[0] ?? null, updated_at };
  }

  #wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.#delayMs));
  }
}
