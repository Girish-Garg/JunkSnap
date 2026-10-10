import type { AcceptedScan, ScanPresignRequest, ScanPresignResponse, ScanSession, ScanStatus, ScanStatusView } from '../domain/ScanUpload';
import { VIDEO_EXTENSIONS } from '../domain/ScanUpload';
import { isoSeconds } from '../domain/utils';
import type { ScanApi } from './ScanApi';

// Each poll moves a sample scan one step; done cuts one frame a second, like the worker.
const STEPS: readonly ScanStatus[] = ['queued', 'processing', 'done'];

/** Mock mode: nothing leaves the phone. */
export class MockScanApi implements ScanApi {
  readonly #delayMs: number;
  readonly #sessions = new Map<string, ScanSession>();
  readonly #polls = new Map<string, number>();
  #count = 0;

  constructor(delayMs = 400) {
    this.#delayMs = delayMs;
  }

  async presign(request: ScanPresignRequest): Promise<ScanPresignResponse> {
    await this.#wait();
    this.#count += 1;
    const scanId = `scn_sample_${Date.now().toString(36)}_${this.#count}`;
    const url = `sample://scans/${scanId}.${VIDEO_EXTENSIONS[request.content_type]}`;
    const headers = { 'Content-Type': request.content_type, 'x-amz-checksum-sha256': 'sample' };
    return { scan_id: scanId, upload_url: url, headers, expires_at: isoSeconds(new Date(Date.now() + 300_000)) };
  }

  async putVideo(): Promise<void> {
    await this.#wait();
  }

  async submit(session: ScanSession): Promise<AcceptedScan> {
    await this.#wait();
    this.#sessions.set(session.scan_id, session);
    return { scan_id: session.scan_id, status: 'queued' };
  }

  async status(scanId: string): Promise<ScanStatusView> {
    await this.#wait();
    const poll = this.#polls.get(scanId) ?? 0;
    this.#polls.set(scanId, poll + 1);
    const status = STEPS[Math.min(poll, STEPS.length - 1)] ?? 'queued';
    const updated_at = isoSeconds(new Date());
    if (status !== 'done') return { scan_id: scanId, status, reason: null, frames: null, report_ids: [], updated_at };
    const sampled = Math.max(1, Math.floor((this.#sessions.get(scanId)?.duration_ms ?? 1000) / 1000));
    const report_ids = Array.from({ length: sampled }, (_, i) => `rpt_${scanId.slice(4)}_${i}`);
    return { scan_id: scanId, status, reason: null, frames: { sampled, kept: sampled, dropped_no_fix: 0 }, report_ids, updated_at };
  }

  #wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.#delayMs));
  }
}
