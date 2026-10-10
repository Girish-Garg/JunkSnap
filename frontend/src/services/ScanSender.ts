import { ApiError } from '../domain/ApiError';
import { JunkSnapError } from '../domain/JunkSnapError';
import type { QueuedScan } from '../domain/QueuedScan';
import type { ScanPresignResponse } from '../domain/ScanUpload';
import type { Clock } from './Clock';
import type { RequestIdentity } from './ReportApi';
import type { ScanApi } from './ScanApi';
import { SignedInStep } from './SignedInStep';

const MAX_PRESIGNS = 3;

/** Moves one recording one step: presign, PUT the video, then POST /scans with the presigned scan_id. */
export class ScanSender {
  readonly #api: ScanApi;
  readonly #identity: RequestIdentity;
  readonly #clock: Clock;
  readonly #signedIn: SignedInStep;

  constructor(api: ScanApi, identity: RequestIdentity, clock: Clock) {
    this.#api = api;
    this.#identity = identity;
    this.#clock = clock;
    this.#signedIn = new SignedInStep(identity);
  }

  step(scan: QueuedScan): Promise<QueuedScan> {
    return this.#signedIn.run(() => this.#advance(scan));
  }

  async #advance(scan: QueuedScan): Promise<QueuedScan> {
    const now = this.#clock.now();
    if (scan.needsPresign(now)) return scan.presigned(await this.#presign(scan), now);
    if (scan.data.stage === 'saved') return this.#put(scan);
    const accepted = await this.#api.submit(scan.toSession(await this.#identity.deviceToken()));
    return scan.sent(accepted.scan_id);
  }

  async #presign(scan: QueuedScan): Promise<ScanPresignResponse> {
    const { content_type, video_sha256, size_bytes, duration_ms } = scan.data.draft;
    const device_token = await this.#identity.deviceToken();
    return this.#api.presign({ content_type, sha256: video_sha256, size_bytes, duration_ms, device_token });
  }

  async #put(scan: QueuedScan): Promise<QueuedScan> {
    const { upload, video } = scan.data;
    if (!upload || !video) throw new JunkSnapError(`Scan ${scan.id} has no video or URL to upload`);
    try {
      await this.#api.putVideo(upload, video);
    } catch (error) {
      const stale = error instanceof ApiError && error.code === 'upload_refused';
      if (stale && scan.data.put_refusals < MAX_PRESIGNS) return scan.dropUpload();
      throw error;
    }
    return scan.uploaded();
  }
}
