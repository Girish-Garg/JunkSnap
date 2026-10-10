import type { LonLat } from './Site';
import { metresBetween } from './utils';

/** A fix older than this says little about where the person is now, so distance rules ignore it. */
export const FRESH_FIX_MS = 120_000;

/** A location fix with the time the app got it; distance gates only trust it while it is fresh. */
export class FreshFix {
  readonly at: LonLat;
  readonly takenMs: number;

  constructor(at: LonLat, takenMs: number) {
    this.at = at;
    this.takenMs = takenMs;
  }

  /** Milliseconds until the fix is too old, never below 0. */
  msLeft(nowMs: number): number {
    return Math.max(0, this.takenMs + FRESH_FIX_MS - nowMs);
  }

  isFresh(nowMs: number): boolean {
    return this.msLeft(nowMs) > 0;
  }

  /** Metres to a point while the fix is fresh; null once it is stale, so nothing blocks on it. */
  metresTo(point: LonLat, nowMs: number): number | null {
    return this.isFresh(nowMs) ? metresBetween(this.at, point) : null;
  }
}
