import { JunkSnapError } from './JunkSnapError';
import type { QueueItem } from './QueueItem';
import type { QueueStage, SendProblem } from './QueuedReport';
import { VIDEO_EXTENSIONS, type ScanDraft, type ScanPresignResponse, type ScanSession, type ScanStatusView } from './ScanUpload';

export interface PendingScanUpload extends ScanPresignResponse {
  readonly presigned_at: string;
}

/** The IndexedDB record of one recording; id is the video's SHA-256, so one video is queued once. */
export interface QueuedScanData {
  readonly id: string;
  readonly stage: QueueStage;
  readonly draft: ScanDraft;
  /** Video bytes; dropped once the scan is posted. */
  readonly video: ArrayBuffer | null;
  readonly upload: PendingScanUpload | null;
  readonly scan_id: string | null;
  readonly status: ScanStatusView | null;
  readonly attempts: number;
  readonly put_refusals: number;
  readonly retry_at: string | null;
  readonly problem: SendProblem | null;
  readonly saved_at: string;
}

// Presigned URLs live PRESIGN_TTL_SECONDS (300 s); re-presign a little before that.
const UPLOAD_URL_LIFETIME_MS = 240_000;
const CLEAR_WAIT = { problem: null, retry_at: null } as const;

export class QueuedScan implements QueueItem<QueuedScan, QueuedScanData> {
  readonly data: QueuedScanData;

  private constructor(data: QueuedScanData) {
    this.data = data;
  }

  static fromData(data: QueuedScanData): QueuedScan {
    return new QueuedScan(data);
  }

  static record(draft: ScanDraft, video: ArrayBuffer, now: Date): QueuedScan {
    const empty = { upload: null, scan_id: null, status: null, attempts: 0, put_refusals: 0, ...CLEAR_WAIT };
    return new QueuedScan({ id: draft.video_sha256, stage: 'saved', draft, video, ...empty, saved_at: now.toISOString() });
  }

  get id(): string {
    return this.data.id;
  }

  isPending(): boolean {
    return this.data.stage === 'saved' || this.data.stage === 'uploaded';
  }

  isDue(now: Date): boolean {
    if (!this.isPending() || this.data.problem === 'sign_in') return false;
    return this.data.retry_at === null || Date.parse(this.data.retry_at) <= now.getTime();
  }

  needsPresign(now: Date): boolean {
    const upload = this.data.upload;
    if (this.data.stage !== 'saved') return false;
    return upload === null || now.getTime() - Date.parse(upload.presigned_at) > UPLOAD_URL_LIFETIME_MS;
  }

  /** Body of POST /scans; the video key follows the scan id and the recorded container. */
  toSession(deviceToken: string): ScanSession {
    const scanId = this.data.upload?.scan_id;
    if (!scanId) throw new JunkSnapError(`Scan ${this.id} has no scan id yet`);
    const { report_type, context, started_at, ended_at, duration_ms, content_type, video_sha256, gps_track, hints } = this.data.draft;
    const video_key = `scans/${scanId}.${VIDEO_EXTENSIONS[content_type]}`;
    const session = { scan_id: scanId, device_token: deviceToken, report_type, context, started_at, ended_at, duration_ms, video_key, video_sha256, gps_track };
    return hints ? { ...session, hints } : session;
  }

  presigned(upload: ScanPresignResponse, now: Date): QueuedScan {
    return this.#with({ upload: { ...upload, presigned_at: now.toISOString() }, ...CLEAR_WAIT });
  }

  dropUpload(): QueuedScan {
    return this.#with({ upload: null, put_refusals: this.data.put_refusals + 1 });
  }

  uploaded(): QueuedScan {
    return this.#with({ stage: 'uploaded', ...CLEAR_WAIT });
  }

  sent(scanId: string): QueuedScan {
    return this.#with({ stage: 'sent', scan_id: scanId, video: null, ...CLEAR_WAIT });
  }

  withStatus(status: ScanStatusView): QueuedScan {
    return this.#with({ status });
  }

  failed(problem: SendProblem, retryAt: Date | null): QueuedScan {
    const stage = problem === 'refused' ? 'failed' : this.data.stage;
    const retry_at = retryAt ? retryAt.toISOString() : null;
    return this.#with({ stage, problem, retry_at, attempts: this.data.attempts + 1 });
  }

  retryNow(): QueuedScan {
    if (this.data.stage !== 'failed') return this.#with(CLEAR_WAIT);
    return this.#with({ stage: 'saved', upload: null, attempts: 0, put_refusals: 0, ...CLEAR_WAIT });
  }

  #with(changes: Partial<QueuedScanData>): QueuedScan {
    return new QueuedScan({ ...this.data, ...changes });
  }
}
