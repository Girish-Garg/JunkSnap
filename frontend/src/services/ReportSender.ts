import { ApiError } from '../domain/ApiError';
import { JunkSnapError } from '../domain/JunkSnapError';
import type { QueuedReport } from '../domain/QueuedReport';
import type { PresignResponse } from '../domain/ReportUpload';
import type { Clock } from './Clock';
import type { ReportApi, RequestIdentity } from './ReportApi';
import { SignedInStep } from './SignedInStep';

// A refused PUT gets this many fresh URLs before the report counts as refused.
const MAX_PRESIGNS = 3;

/** Moves one queued report one step: presign, PUT the photo, then POST /reports with the same upload_id. */
export class ReportSender {
  readonly #api: ReportApi;
  readonly #identity: RequestIdentity;
  readonly #clock: Clock;
  readonly #signedIn: SignedInStep;

  constructor(api: ReportApi, identity: RequestIdentity, clock: Clock) {
    this.#api = api;
    this.#identity = identity;
    this.#clock = clock;
    this.#signedIn = new SignedInStep(identity);
  }

  step(report: QueuedReport): Promise<QueuedReport> {
    return this.#signedIn.run(() => this.#advance(report));
  }

  async #advance(report: QueuedReport): Promise<QueuedReport> {
    const now = this.#clock.now();
    if (report.needsPresign(now)) return report.presigned(await this.#presign(report), now);
    if (report.data.stage === 'saved') return this.#put(report);
    const accepted = await this.#api.submit(report.toUpload(await this.#identity.deviceToken()));
    return report.sent(accepted.report_id);
  }

  async #presign(report: QueuedReport): Promise<PresignResponse> {
    const device_token = await this.#identity.deviceToken();
    return this.#api.presign({ purpose: 'report', content_type: 'image/jpeg', sha256: report.data.draft.sha256, device_token });
  }

  async #put(report: QueuedReport): Promise<QueuedReport> {
    const { upload, photo } = report.data;
    if (!upload || !photo) throw new JunkSnapError(`Report ${report.id} has no photo or URL to upload`);
    try {
      await this.#api.putPhoto(upload, photo);
    } catch (error) {
      const stale = error instanceof ApiError && error.code === 'upload_refused';
      if (stale && report.data.put_refusals < MAX_PRESIGNS) return report.dropUpload();
      throw error;
    }
    return report.uploaded();
  }
}
