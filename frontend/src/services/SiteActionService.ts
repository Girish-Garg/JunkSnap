import type { CleanupAccepted, LetterDraft, LetterLanguage, VoteChoice, VoteResult, WithdrawalResult } from '../domain/SiteActions';
import type { NoteLanguage, SiteNote } from '../domain/Community';
import type { PhotoFlagReason, PhotoFlagResult } from '../domain/PhotoFlag';
import type { GpsFix } from '../domain/ReportUpload';
import type { GpsWatcher } from './GpsWatcher';
import type { ReportApi, RequestIdentity } from './ReportApi';
import { SignedInStep } from './SignedInStep';
import type { SiteActionsApi } from './SiteActionsApi';

export interface SiteActionPorts {
  readonly api: SiteActionsApi;
  /** Presign and PUT for the cleanup after-photo, the same routes as a report photo. */
  readonly uploads: Pick<ReportApi, 'presign' | 'putPhoto'>;
  readonly identity: RequestIdentity;
  readonly gps: GpsWatcher;
}

/** The after-photo, hashed, with the place and time frozen at the shutter. */
export interface AfterPhoto {
  readonly bytes: ArrayBuffer;
  readonly sha256: string;
  readonly gps: GpsFix;
  readonly capturedAt: string;
}

/** Votes, cleanup claims and letter drafts for one site; each needs a signed-in user. */
export class SiteActionService {
  readonly #ports: SiteActionPorts;
  readonly #signedIn: SignedInStep;

  constructor(ports: SiteActionPorts) {
    this.#ports = ports;
    this.#signedIn = new SignedInStep(ports.identity);
  }

  /** The api checks the voter is within 1 km, so the vote carries a fresh fix. */
  async vote(siteId: string, vote: VoteChoice): Promise<VoteResult> {
    const gps = await this.#ports.gps.current();
    const device_token = await this.#ports.identity.deviceToken();
    return this.#signedIn.run(() => this.#ports.api.vote(siteId, { device_token, vote, gps }));
  }

  /** Presign with purpose cleanup, PUT the after-photo, then claim the cleanup. */
  cleanup(siteId: string, photo: AfterPhoto): Promise<CleanupAccepted> {
    return this.#signedIn.run(async () => {
      const device_token = await this.#ports.identity.deviceToken();
      const upload = await this.#ports.uploads.presign({ purpose: 'cleanup', content_type: 'image/jpeg', sha256: photo.sha256, device_token });
      await this.#ports.uploads.putPhoto(upload, photo.bytes);
      const request = { upload_id: upload.upload_id, device_token, sha256: photo.sha256, gps: photo.gps, captured_at: photo.capturedAt };
      return this.#ports.api.cleanup(siteId, request);
    });
  }

  async note(siteId: string, text: string, language: NoteLanguage): Promise<SiteNote> {
    const device_token = await this.#ports.identity.deviceToken();
    return this.#signedIn.run(() => this.#ports.api.note(siteId, { text, language, device_token }));
  }

  /** Reports one site photo from within 1 km, like a vote; a blank description is left out (decision 20261011-0310-hem-photo-flags). */
  async flagPhoto(siteId: string, photoId: string, reason: PhotoFlagReason, text: string): Promise<PhotoFlagResult> {
    const gps = await this.#ports.gps.current();
    const device_token = await this.#ports.identity.deviceToken();
    const described = text.trim() === '' ? {} : { text: text.trim() };
    return this.#signedIn.run(() => this.#ports.api.flagPhoto(siteId, photoId, { reason, device_token, gps, ...described }));
  }

  /** Takes this user's reports off a site that is not verified yet. */
  withdraw(siteId: string): Promise<WithdrawalResult> {
    return this.#signedIn.run(() => this.#ports.api.withdraw(siteId));
  }

  async letter(siteId: string, language: LetterLanguage): Promise<LetterDraft> {
    const device_token = await this.#ports.identity.deviceToken();
    return this.#signedIn.run(() => this.#ports.api.letter(siteId, { device_token, channel: 'local_body', language }));
  }
}
