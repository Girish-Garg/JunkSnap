import { QueuedReport } from '../domain/QueuedReport';
import type { AcceptedReport, GpsFix, NoBinUpload } from '../domain/ReportUpload';
import { isoSeconds } from '../domain/utils';
import type { ReportApi, RequestIdentity } from './ReportApi';
import { SignedInStep } from './SignedInStep';

// Decision 20261010-1630: the server refuses a no-bin report less accurate than this.
export const NO_BIN_MAX_ACCURACY_M = 50;
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
const ID_LENGTH = 26;

/** Where an accepted report is kept so Activity shows it at once (the report queue's store). */
export interface ActivityRecorder {
  save(item: QueuedReport): Promise<void>;
}

/** "There is no dustbin within 1 km of here", sent straight away without a photo; the app makes the upload id. */
export class NoBinReporter {
  readonly #api: ReportApi;
  readonly #identity: RequestIdentity;
  readonly #random: () => Uint8Array;
  readonly #activity: ActivityRecorder | null;

  constructor(api: ReportApi, identity: RequestIdentity, random: () => Uint8Array, activity: ActivityRecorder | null = null) {
    this.#api = api;
    this.#identity = identity;
    this.#random = random;
    this.#activity = activity;
  }

  static accurateEnough(fix: GpsFix | null): boolean {
    return fix !== null && fix.accuracy_m <= NO_BIN_MAX_ACCURACY_M;
  }

  async report(gps: GpsFix, now: Date = new Date()): Promise<AcceptedReport> {
    return this.send(await this.prepare(gps, now), now);
  }

  /**
   * The upload for this attempt, from the fix and time now. A retry passes the last attempt's upload: it keeps that
   * upload id, so the server (which dedups on it) still makes one report.
   */
  async prepare(gps: GpsFix, now: Date = new Date(), retrying: NoBinUpload | null = null): Promise<NoBinUpload> {
    if (!NoBinReporter.accurateEnough(gps)) throw new RangeError(`GPS accuracy ${gps.accuracy_m} m is worse than ${NO_BIN_MAX_ACCURACY_M} m`);
    const device_token = await this.#identity.deviceToken();
    return {
      upload_id: retrying?.upload_id ?? `upl_${this.#id()}`,
      report_type: 'no_bin',
      context: 'no_bin',
      capture_mode: 'snap',
      gps,
      captured_at: isoSeconds(now),
      device_token,
    };
  }

  /** Sends a prepared upload, then keeps it in Activity. */
  async send(upload: NoBinUpload, now: Date = new Date()): Promise<AcceptedReport> {
    const accepted = await new SignedInStep(this.#identity).run(() => this.#api.submit(upload));
    await this.#record(upload, accepted, now);
    return accepted;
  }

  // The report is already on the server, so a phone that cannot store the row still counts it as sent.
  async #record(upload: NoBinUpload, accepted: AcceptedReport, now: Date): Promise<void> {
    const draft = { report_type: upload.report_type, context: upload.context, sha256: '', gps: upload.gps, captured_at: upload.captured_at };
    await this.#activity?.save(QueuedReport.sentNoBin(draft, accepted.report_id, now)).catch(() => undefined);
  }

  // 26 lowercase Crockford base-32 characters, like the server's ULID-based ids.
  #id(): string {
    const bytes = [...this.#random(), ...this.#random()];
    return bytes
      .slice(0, ID_LENGTH)
      .map((byte) => CROCKFORD[byte % CROCKFORD.length])
      .join('');
  }
}
