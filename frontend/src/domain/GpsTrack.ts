import type { GpsFix } from './ReportUpload';
import { SCAN_LIMITS, type TrackFix } from './ScanUpload';

// Keeps at most 10 fixes a second, so 60 s never passes the schema's 600.
const MIN_SPACING_MS = 100;
// Padding after 500 ms of silence, checked every 250 ms, keeps every gap under 1 s (the api's minimum rate).
const PAD_AFTER_MS = 500;
export const GPS_TRACK_TICK_MS = 250;
// A fix used later than it was taken may be stale if the phone moves (a scooter does about 15 m/s), so its accuracy grows by this much a second.
const STALE_WIDENING_M_PER_S = 15;

/** A fix and when the GPS took it (coords.timestamp), on the recorder's clock. */
export interface TakenFix {
  readonly fix: GpsFix;
  readonly takenAtMs: number;
}

/** The GPS track of one recording: t_ms from the start, strictly increasing, at least one fix a second. */
export class GpsTrack {
  readonly #startMs: number;
  readonly #fixes: TrackFix[] = [];
  #latest: TakenFix;

  /** startMs is the recording start; the first fix sits at t_ms 0, widened by how old it is then. */
  constructor(startMs: number, first: TakenFix) {
    this.#startMs = startMs;
    this.#latest = first;
    this.#place(first, Math.max(startMs, first.takenAtMs));
  }

  /** Placed at the time the GPS took it, not when it reached the page. */
  add(taken: TakenFix): void {
    if (taken.takenAtMs >= this.#latest.takenAtMs) this.#latest = taken;
    this.#place(taken, taken.takenAtMs);
  }

  /** Called every GPS_TRACK_TICK_MS: repeats the last fix, widened by its age, when no new one came in. */
  pad(atMs: number): void {
    const last = this.#fixes.at(-1);
    if (last && this.#startMs + last.t_ms > atMs - PAD_AFTER_MS) return;
    this.#place(this.#latest, atMs);
  }

  /** Fixes up to the end of the video. */
  fixes(durationMs: number): readonly TrackFix[] {
    return this.#fixes.filter((fix) => fix.t_ms <= durationMs);
  }

  #place({ fix, takenAtMs }: TakenFix, atMs: number): void {
    const t_ms = Math.round(atMs - this.#startMs);
    const last = this.#fixes.at(-1);
    if (t_ms < 0 || t_ms > SCAN_LIMITS.maxDurationMs || this.#fixes.length >= SCAN_LIMITS.maxFixes) return;
    if (last && t_ms - last.t_ms < MIN_SPACING_MS) return;
    const ageS = Math.max(0, atMs - takenAtMs) / 1000;
    const accuracy_m = Math.round((fix.accuracy_m + ageS * STALE_WIDENING_M_PER_S) * 10) / 10;
    this.#fixes.push({ t_ms, lat: fix.lat, lon: fix.lon, accuracy_m });
  }
}
