import { ApiError } from '../src/domain/ApiError';
import type { AcceptedScan, FrameFinding, FrameResult, ScanFound, ScanPresignRequest, ScanPresignResponse, ScanSession, ScanStatusView } from '../src/domain/ScanUpload';
import type { ScanApi } from '../src/services/ScanApi';
import type { RecorderFactory } from '../src/services/VideoRecorder';

type Call = 'presign' | 'put' | 'submit' | 'status';

const frame = (i: number, result: FrameResult, report_type: FrameFinding['report_type'], site_id: string | null): FrameFinding => ({
  report_id: `rpt_${'abcdef'[i] ?? 'z'}`,
  t_ms: i * 1000,
  result,
  report_type,
  site_id,
  blurred_url: result === 'skipped' ? null : `https://cdn.test/media/reports/rpt_${i}.jpg`,
});

/** Six frames: two of one dump, one overflowing bin, two not waste and a repeat view. */
export const SAMPLE_FOUND: ScanFound = {
  sites: 2,
  by_type: { waste_dump: 1, overflowing_bin: 1 },
  checking: 0,
  frames: [
    frame(0, 'waiting', 'waste_dump', 'site_1'),
    frame(1, 'waiting', 'waste_dump', 'site_1'),
    frame(2, 'skipped', 'waste_dump', null),
    frame(3, 'added', 'overflowing_bin', 'site_2'),
    frame(4, 'not_waste', 'waste_dump', null),
    frame(5, 'not_waste', 'waste_dump', null),
  ],
};

/** Records every call; failNext queues a failure for the next call of a kind. */
export class FakeScanApi implements ScanApi {
  readonly calls: { readonly kind: Call; readonly body?: unknown }[] = [];
  readonly #failures = new Map<Call, ApiError[]>();
  done = true;
  found: ScanFound = SAMPLE_FOUND;

  failNext(kind: Call, status: number, code = 'error'): void {
    this.#failures.set(kind, [...(this.#failures.get(kind) ?? []), new ApiError(status, code, `${kind} failed`)]);
  }

  bodies(kind: Call): unknown[] {
    return this.calls.filter((call) => call.kind === kind).map((call) => call.body);
  }

  async presign(request: ScanPresignRequest): Promise<ScanPresignResponse> {
    this.#record('presign', request);
    const scanId = `scn_test_${this.bodies('presign').length}`;
    const headers = { 'Content-Type': request.content_type, 'x-amz-checksum-sha256': 'abc=' };
    return { scan_id: scanId, upload_url: `https://s3.test/scans/${scanId}`, headers, expires_at: '2026-10-10T04:05:00Z' };
  }

  async putVideo(upload: ScanPresignResponse): Promise<void> {
    this.#record('put', upload.scan_id);
  }

  async submit(session: ScanSession): Promise<AcceptedScan> {
    this.#record('submit', session);
    return { scan_id: session.scan_id, status: 'queued' };
  }

  async status(scanId: string): Promise<ScanStatusView> {
    this.#record('status', scanId);
    const frames = this.done ? { sampled: 8, kept: 6, dropped_no_fix: 2 } : null;
    const report_ids = this.done ? SAMPLE_FOUND.frames.map((frame) => frame.report_id) : [];
    const found = this.done ? this.found : null;
    return { scan_id: scanId, status: this.done ? 'done' : 'processing', reason: null, frames, report_ids, found, updated_at: '2026-10-10T04:01:00Z' };
  }

  #record(kind: Call, body: unknown): void {
    this.calls.push({ kind, body });
    const failure = this.#failures.get(kind)?.shift();
    if (failure) throw failure;
  }
}

/** MediaRecorder that emits one small chunk on stop, as browsers flush the last slice. */
export class FakeMediaRecorder {
  static supported: readonly string[] = ['video/webm;codecs=vp8', 'video/webm'];
  static last: FakeMediaRecorder | null = null;
  state: RecordingState = 'inactive';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  readonly options: MediaRecorderOptions | undefined;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.options = options;
    FakeMediaRecorder.last = this;
  }

  static isTypeSupported(type: string): boolean {
    return FakeMediaRecorder.supported.includes(type);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['video bytes']) } as BlobEvent);
    this.onstop?.();
  }
}

export const fakeRecorderFactory = FakeMediaRecorder as unknown as RecorderFactory;
