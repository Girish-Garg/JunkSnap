import type { LonLat } from './Site';
import { metresBetween } from './utils';

/**
 * A location fix with the time the app got it; distance gates only trust it while it is fresh. A fix older than
 * lifetimeMs (the config's capture.freshFixMs, 2 minutes) says little about where the person is now.
 */
export class FreshFix {
  readonly at: LonLat;
  readonly takenMs: number;
  readonly #lifetimeMs: number;

  constructor(at: LonLat, takenMs: number, lifetimeMs: number) {
    this.at = at;
    this.takenMs = takenMs;
    this.#lifetimeMs = lifetimeMs;
  }

  /** Milliseconds until the fix is too old, never below 0. */
  msLeft(nowMs: number): number {
    return Math.max(0, this.takenMs + this.#lifetimeMs - nowMs);
  }

  isFresh(nowMs: number): boolean {
    return this.msLeft(nowMs) > 0;
  }

  /** Metres to a point while the fix is fresh; null once it is stale, so nothing blocks on it. */
  metresTo(point: LonLat, nowMs: number): number | null {
    return this.isFresh(nowMs) ? metresBetween(this.at, point) : null;
  }
}
