import type { AcceptedReport, GpsFix, NoBinUpload } from '../domain/ReportUpload';
import { isoSeconds } from '../domain/utils';
import type { ReportApi, RequestIdentity } from './ReportApi';
import { SignedInStep } from './SignedInStep';

// Decision 20261010-1630: the server refuses a no-bin report less accurate than this.
export const NO_BIN_MAX_ACCURACY_M = 50;
const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
const ID_LENGTH = 26;

/** "There is no dustbin within 1 km of here", sent straight away without a photo; the app makes the upload id. */
export class NoBinReporter {
  readonly #api: ReportApi;
  readonly #identity: RequestIdentity;
  readonly #random: () => Uint8Array;

  constructor(api: ReportApi, identity: RequestIdentity, random: () => Uint8Array) {
    this.#api = api;
    this.#identity = identity;
    this.#random = random;
  }

  static accurateEnough(fix: GpsFix | null): boolean {
    return fix !== null && fix.accuracy_m <= NO_BIN_MAX_ACCURACY_M;
  }

  async report(gps: GpsFix, now: Date = new Date()): Promise<AcceptedReport> {
    if (!NoBinReporter.accurateEnough(gps)) throw new RangeError(`GPS accuracy ${gps.accuracy_m} m is worse than ${NO_BIN_MAX_ACCURACY_M} m`);
    const device_token = await this.#identity.deviceToken();
    const upload: NoBinUpload = {
      upload_id: `upl_${this.#id()}`,
      report_type: 'no_bin',
      context: 'no_bin',
      capture_mode: 'snap',
      gps,
      captured_at: isoSeconds(now),
      device_token,
    };
    return new SignedInStep(this.#identity).run(() => this.#api.submit(upload));
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
