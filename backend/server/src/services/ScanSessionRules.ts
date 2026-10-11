import type { ScanSession } from "../contracts/index.gen.js";
import { ValidationError } from "../domain/errors.js";

const MS_PER_SECOND = 1_000;

// Checks a posted session for what its JSON schema cannot express.
export class ScanSessionRules {
  readonly #minFixesPerSecond: number;

  // minFixesPerSecond: SCAN_MIN_FIXES_PER_SECOND.
  constructor(minFixesPerSecond: number) {
    this.#minFixesPerSecond = minFixesPerSecond;
  }

  check(session: ScanSession): void {
    ScanSessionRules.#checkVideoKey(session);
    ScanSessionRules.#checkTimes(session);
    ScanSessionRules.#checkTrackOrder(session);
    this.#checkTrackRate(session);
  }

  static #checkVideoKey({ scan_id, video_key }: ScanSession): void {
    if (video_key.slice(0, video_key.lastIndexOf(".")) !== `scans/${scan_id}`) {
      throw new ValidationError(`video_key must be scans/${scan_id}.webm or .mp4`);
    }
  }

  static #checkTimes({ started_at, ended_at }: ScanSession): void {
    if (Date.parse(ended_at) <= Date.parse(started_at)) {
      throw new ValidationError("ended_at must be after started_at");
    }
  }

  static #checkTrackOrder({ gps_track }: ScanSession): void {
    const index = gps_track.findIndex((fix, i) => i > 0 && fix.t_ms <= (gps_track[i - 1]?.t_ms ?? -1));
    if (index !== -1) {
      throw new ValidationError(`gps_track t_ms must increase from fix to fix; fix ${index} does not`);
    }
  }

  // At least one fix per whole second of video, so a 1 Hz watchPosition always passes.
  #checkTrackRate({ gps_track, duration_ms }: ScanSession): void {
    const needed = Math.max(1, Math.floor((duration_ms / MS_PER_SECOND) * this.#minFixesPerSecond));
    if (gps_track.length < needed) {
      const message = `gps_track needs at least ${needed} fixes for ${duration_ms} ms of video; it has ${gps_track.length}`;
      throw new ValidationError(message);
    }
  }
}
