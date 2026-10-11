import { RateLimitedError } from "../domain/RateLimitedError.js";
import type { Reporter } from "../domain/ReportRecord.js";
import { isoSeconds } from "../domain/timeUtils.js";
import type { SnapCounter } from "../ports/SnapCounter.js";

const WINDOW_MS = 3_600_000;

// At most maxPhotos (SNAP_PER_HOUR) snap photos in the last hour, per user and per device; the stricter count applies.
export class SnapLimit {
  readonly #counter: SnapCounter;
  readonly #maxPhotos: number;

  constructor(counter: SnapCounter, maxPhotos: number) {
    this.#counter = counter;
    this.#maxPhotos = maxPhotos;
  }

  async check(reporter: Reporter, now: Date): Promise<void> {
    const since = isoSeconds(new Date(now.getTime() - WINDOW_MS));
    const counts = [this.#counter.byDevice(reporter.deviceToken, since)];
    if (reporter.userId !== undefined) {
      counts.push(this.#counter.byUser(reporter.userId, since));
    }
    if (Math.max(...(await Promise.all(counts))) >= this.#maxPhotos) {
      throw new RateLimitedError(`Too many photos; the limit is ${this.#maxPhotos} photos per hour.`);
    }
  }
}
