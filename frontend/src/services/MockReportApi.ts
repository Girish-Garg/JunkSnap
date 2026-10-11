import { NETWORK_DEFAULTS } from '../config/NetworkSettings';
import { ApiError } from '../domain/ApiError';
import type { ConfirmRequest } from '../domain/ReportConfirmation';
import type { ReportListPage } from '../domain/ReportList';
import type { ReportStatus, ReportStatusView } from '../domain/ReportStatus';
import type { AcceptedReport, PresignRequest, PresignResponse, ReportUpload } from '../domain/ReportUpload';
import type { SiteFeature } from '../domain/Site';
import { isoSeconds } from '../domain/utils';
import type { MockConfirmations } from './MockConfirmations';
import type { MockReportEvidence } from './MockReportEvidence';
import type { ReportApi } from './ReportApi';

// Each poll moves a sample report one step; the last step joins it to the jdh-1 sample site.
const STEPS: readonly ReportStatus[] = ['queued', 'processing', 'verified'];

/** Mock mode: nothing leaves the phone. */
export class MockReportApi implements ReportApi {
  readonly #sampleSite: () => Promise<SiteFeature>;
  readonly #delayMs: number;
  readonly #evidence: MockReportEvidence | null;
  readonly #confirmations: MockConfirmations | null;
  readonly #polls = new Map<string, number>();
  #count = 0;

  /**
   * evidence: the fixtures behind the "What we checked" view; null leaves statuses bare, as tests expect.
   * confirmations: reports the check was unsure about; null never asks.
   */
  constructor(sampleSite: () => Promise<SiteFeature>, delayMs = NETWORK_DEFAULTS.mockDelayMs, evidence: MockReportEvidence | null = null, confirmations: MockConfirmations | null = null) {
    this.#sampleSite = sampleSite;
    this.#delayMs = delayMs;
    this.#evidence = evidence;
    this.#confirmations = confirmations;
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
    const reportId = upload.upload_id.replace(/^upl_/, 'rpt_');
    this.#confirmations?.noteSubmitted(reportId, upload.report_type);
    return { report_id: reportId, status: 'queued' };
  }

  async status(reportId: string): Promise<ReportStatusView> {
    await this.#wait();
    const updated_at = isoSeconds(new Date());
    const frame = await this.#evidence?.frame(reportId, updated_at);
    if (frame) return frame;
    const poll = this.#polls.get(reportId) ?? 0;
    this.#polls.set(reportId, poll + 1);
    const status = STEPS[Math.min(poll, STEPS.length - 1)] ?? 'queued';
    if (status !== 'verified') return { report_id: reportId, status, site_id: null, blurred_url: null, updated_at };
    return (await this.#confirmations?.settled(reportId, new Date())) ?? this.#verified(reportId, updated_at);
  }

  async #verified(reportId: string, updated_at: string): Promise<ReportStatusView> {
    const site = (await this.#sampleSite()).properties;
    const view: ReportStatusView = { report_id: reportId, status: 'verified', site_id: site.site_id, blurred_url: site.photo_urls[0] ?? null, updated_at };
    return this.#evidence ? this.#evidence.snap(view) : view;
  }

  async confirm(reportId: string, request: ConfirmRequest): Promise<ReportStatusView> {
    await this.#wait();
    if (!this.#confirmations) throw new ApiError(409, 'confirmation_closed', 'This report is not waiting for an answer.');
    return this.#confirmations.answer(reportId, request.sure, new Date());
  }

  /** Mock mode keeps nothing off the phone, so the server list is empty and Activity keeps its own rows. */
  async mine(): Promise<ReportListPage> {
    await this.#wait();
    return { reports: [], next_cursor: null };
  }

  #wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.#delayMs));
  }
}
