import type { GpsFix } from './ReportUpload';
import { SCAN_LIMITS, type TrackFix } from './ScanUpload';

// Keeps at most 10 fixes a second, so 60 s never passes the schema's 600.
const MIN_SPACING_MS = 100;
// Padding after 500 ms of silence, checked every 250 ms, keeps every gap under 1 s (the api's minimum rate).
const PAD_AFTER_MS = 500;
export const GPS_TRACK_TICK_MS = 250;
// A repeated fix may be stale while the phone moves, so its accuracy grows by this much a second.
const STALE_WIDENING_M_PER_S = 10;

interface Latest {
  readonly fix: GpsFix;
  readonly atMs: number;
}

/** The GPS track of one recording: t_ms from the start, strictly increasing, at least one fix a second. */
export class GpsTrack {
  readonly #startMs: number;
  readonly #fixes: TrackFix[] = [];
  #latest: Latest | null = null;

  /** startMs is the recording start; the first fix is placed at t_ms 0. */
  constructor(startMs: number, first: GpsFix) {
    this.#startMs = startMs;
    this.add(first, startMs);
  }

  add(fix: GpsFix, atMs: number): void {
    this.#latest = { fix, atMs };
    this.#push(fix, atMs);
  }

  /** Called every GPS_TRACK_TICK_MS: repeats the last fix, widened by its age, when no new one came in. */
  pad(atMs: number): void {
    const last = this.#fixes.at(-1);
    if (!this.#latest || (last && this.#startMs + last.t_ms > atMs - PAD_AFTER_MS)) return;
    const ageS = (atMs - this.#latest.atMs) / 1000;
    const { fix } = this.#latest;
    this.#push({ ...fix, accuracy_m: Math.round((fix.accuracy_m + ageS * STALE_WIDENING_M_PER_S) * 10) / 10 }, atMs);
  }

  /** Fixes up to the end of the video. */
  fixes(durationMs: number): readonly TrackFix[] {
    return this.#fixes.filter((fix) => fix.t_ms <= durationMs);
  }

  #push({ lat, lon, accuracy_m }: GpsFix, atMs: number): void {
    const t_ms = Math.round(atMs - this.#startMs);
    const last = this.#fixes.at(-1);
    if (t_ms < 0 || t_ms > SCAN_LIMITS.maxDurationMs || this.#fixes.length >= SCAN_LIMITS.maxFixes) return;
    if (last && t_ms - last.t_ms < MIN_SPACING_MS) return;
    this.#fixes.push({ t_ms, lat, lon, accuracy_m });
  }
}
