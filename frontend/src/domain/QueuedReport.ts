import { JunkSnapError } from './JunkSnapError';
import type { ReportStatusView } from './ReportStatus';
import type { PresignResponse, ReportDraft, ReportUpload } from './ReportUpload';

/** saved: on the phone; uploaded: photo PUT done; sent: POST /reports accepted; failed: refused for good. */
export type QueueStage = 'saved' | 'uploaded' | 'sent' | 'failed';

export type SendProblem = 'offline' | 'sign_in' | 'rate_limited' | 'server' | 'refused';

export interface PendingUpload extends PresignResponse {
  /** Phone clock at presign, so a wrong phone clock cannot make a stale URL look fresh. */
  readonly presigned_at: string;
}

/** The IndexedDB record; id is the photo's SHA-256, so one photo is queued once. */
export interface QueuedReportData {
  readonly id: string;
  readonly stage: QueueStage;
  readonly draft: ReportDraft;
  /** JPEG bytes; dropped once the report is sent. */
  readonly photo: ArrayBuffer | null;
  readonly upload: PendingUpload | null;
  readonly report_id: string | null;
  readonly status: ReportStatusView | null;
  readonly attempts: number;
  /** S3 refusals of a PUT; each one gets a fresh presigned URL. */
  readonly put_refusals: number;
  readonly retry_at: string | null;
  readonly problem: SendProblem | null;
  readonly saved_at: string;
  /** When GET /me/reports last confirmed this row; absent until a server listing has seen it. */
  readonly synced_at?: string;
}

const CLEAR_WAIT = { problem: null, retry_at: null } as const;

export class QueuedReport {
  readonly data: QueuedReportData;

  private constructor(data: QueuedReportData) {
    this.data = data;
  }

  static fromData(data: QueuedReportData): QueuedReport {
    return new QueuedReport(data);
  }

  static capture(draft: ReportDraft, photo: ArrayBuffer, now: Date): QueuedReport {
    return new QueuedReport({
      id: draft.sha256,
      stage: 'saved',
      draft,
      photo,
      upload: null,
      report_id: null,
      status: null,
      attempts: 0,
      put_refusals: 0,
      retry_at: null,
      problem: null,
      saved_at: now.toISOString(),
    });
  }

  /**
   * A no-bin report the api accepted (no photo, nothing to queue) as an Activity row. Its id is the report id, as
   * ListedReport.rowId gives a listed no-bin report, so GET /me/reports later updates this row instead of adding one.
   */
  static sentNoBin(draft: ReportDraft, reportId: string, now: Date): QueuedReport {
    const empty = { upload: null, status: null, attempts: 0, put_refusals: 0, retry_at: null, problem: null } as const;
    return new QueuedReport({ ...empty, id: reportId, stage: 'sent', draft, photo: null, report_id: reportId, saved_at: now.toISOString() });
  }

  get id(): string {
    return this.data.id;
  }

  isPending(): boolean {
    return this.data.stage === 'saved' || this.data.stage === 'uploaded';
  }

  /** Waiting for sign-in is never due on a timer; signing in retries it. */
  isDue(now: Date): boolean {
    if (!this.isPending() || this.data.problem === 'sign_in') return false;
    return this.data.retry_at === null || Date.parse(this.data.retry_at) <= now.getTime();
  }

  /**
   * The photo still needs a fresh presigned URL before its PUT. Presigned URLs live PRESIGN_TTL_SECONDS (300 s), so
   * one older than reuseMs (network.presignReuseMs, 240 s) is presigned again a little before that.
   */
  needsPresign(now: Date, reuseMs: number): boolean {
    const upload = this.data.upload;
    if (this.data.stage !== 'saved') return false;
    return upload === null || now.getTime() - Date.parse(upload.presigned_at) > reuseMs;
  }

  toUpload(deviceToken: string): ReportUpload {
    const uploadId = this.data.upload?.upload_id;
    if (!uploadId) throw new JunkSnapError(`Report ${this.id} has no upload id yet`);
    return { ...this.data.draft, upload_id: uploadId, capture_mode: 'snap', device_token: deviceToken };
  }

  presigned(upload: PresignResponse, now: Date): QueuedReport {
    return this.#with({ upload: { ...upload, presigned_at: now.toISOString() }, ...CLEAR_WAIT });
  }

  /** S3 refused the PUT: presign again on the next step. */
  dropUpload(): QueuedReport {
    return this.#with({ upload: null, put_refusals: this.data.put_refusals + 1 });
  }

  uploaded(): QueuedReport {
    return this.#with({ stage: 'uploaded', ...CLEAR_WAIT });
  }

  sent(reportId: string): QueuedReport {
    return this.#with({ stage: 'sent', report_id: reportId, photo: null, ...CLEAR_WAIT });
  }

  withStatus(status: ReportStatusView): QueuedReport {
    return this.#with({ status });
  }

  /** The server's listing has this report: keep its status and when it was confirmed. */
  synced(status: ReportStatusView, now: Date): QueuedReport {
    return this.#with({ status, synced_at: now.toISOString() });
  }

  /** Decision 20261010-1700: the reporter took this report back; a report never checked has nothing to withdraw. */
  withdrawn(): QueuedReport {
    const status = this.data.status;
    return status === null ? this : this.#with({ status: { ...status, status: 'withdrawn' } });
  }

  /** retryAt null with a refused problem ends the item; otherwise it waits. */
  failed(problem: SendProblem, retryAt: Date | null): QueuedReport {
    const stage = problem === 'refused' ? 'failed' : this.data.stage;
    const retry_at = retryAt ? retryAt.toISOString() : null;
    return this.#with({ stage, problem, retry_at, attempts: this.data.attempts + 1 });
  }

  /** Clears the wait; a refused item goes back to the start with a fresh upload. */
  retryNow(): QueuedReport {
    if (this.data.stage !== 'failed') return this.#with(CLEAR_WAIT);
    return this.#with({ stage: 'saved', upload: null, attempts: 0, put_refusals: 0, ...CLEAR_WAIT });
  }

  #with(changes: Partial<QueuedReportData>): QueuedReport {
    return new QueuedReport({ ...this.data, ...changes });
  }
}
