import { RateLimitedError } from "../domain/RateLimitedError.js";
import type { Reporter } from "../domain/ReportRecord.js";
import { isoSeconds } from "../domain/timeUtils.js";
import type { SnapCounter } from "../ports/SnapCounter.js";

const MAX_PHOTOS = 20;
const WINDOW_MS = 3_600_000;

// 20 snap photos in the last hour, counted per user and per device; the stricter count applies.
export class SnapLimit {
  readonly #counter: SnapCounter;

  constructor(counter: SnapCounter) {
    this.#counter = counter;
  }

  async check(reporter: Reporter, now: Date): Promise<void> {
    const since = isoSeconds(new Date(now.getTime() - WINDOW_MS));
    const counts = [this.#counter.byDevice(reporter.deviceToken, since)];
    if (reporter.userId !== undefined) {
      counts.push(this.#counter.byUser(reporter.userId, since));
    }
    if (Math.max(...(await Promise.all(counts))) >= MAX_PHOTOS) {
      throw new RateLimitedError(`Too many photos; the limit is ${MAX_PHOTOS} photos per hour.`);
    }
  }
}
