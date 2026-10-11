import { CaptureFix, STALE_FIX_FALLBACK_MS } from '../domain/CaptureFix';
import type { GpsFix } from '../domain/ReportUpload';
import type { GpsListener, GpsWatcher } from './GpsWatcher';
import type { Timer } from './Timer';

interface TakenFix {
  readonly fix: GpsFix;
  readonly takenAtMs: number;
}

/**
 * The fixes capture may use while the camera is open. A fix already more than 10 s old when it arrives (a cached one)
 * is refused; but after 15 s with nothing better (a phone clock off from the GPS's), the newest refused fix is passed on
 * anyway, and later ones that are newer too, so the shutter cannot wait forever. A fix that arrived fresh is never taken
 * back: a phone standing still often gets no more.
 */
export class CaptureFixWatch {
  readonly #gps: GpsWatcher;
  readonly #timer: Timer;

  constructor(gps: GpsWatcher, timer: Timer) {
    this.#gps = gps;
    this.#timer = timer;
  }

  /** Returns a function that stops watching. */
  watch({ onFix, onProblem }: GpsListener): () => void {
    let passed: number | null = null; // takenAtMs of the last fix passed on
    let waiting: TakenFix | null = null; // the newest refused fix
    let patient = true;
    const pass = ({ fix, takenAtMs }: TakenFix) => {
      passed = takenAtMs;
      onFix(fix, takenAtMs);
    };
    const arrive = (taken: TakenFix) => {
      if (CaptureFix.fresh(this.#gps.ageMs(taken.takenAtMs))) return pass(taken);
      if (passed !== null && taken.takenAtMs <= passed) return undefined;
      if (!patient) return pass(taken);
      if (!waiting || taken.takenAtMs > waiting.takenAtMs) waiting = taken;
    };
    const unwatch = this.#gps.watch({ onFix: (fix, takenAtMs) => arrive({ fix, takenAtMs }), onProblem });
    const fallback = this.#timer.set(() => {
      patient = false;
      if (waiting && passed === null) pass(waiting);
    }, STALE_FIX_FALLBACK_MS);
    return () => {
      this.#timer.clear(fallback);
      unwatch();
    };
  }
}
