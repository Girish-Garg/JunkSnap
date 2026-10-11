import { CAPTURE_DEFAULTS, type CaptureSettings } from '../config/CaptureSettings';
import { LocationError, type LocationProblem } from '../domain/LocationError';
import type { GpsFix } from '../domain/ReportUpload';
import type { Clock } from './Clock';
import { SystemClock } from './SystemClock';

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;

/** watchPosition and getCurrentPosition timings; gpsMaxAgeMs stays well under the capture limit (CaptureFix). */
export type GpsTimings = Pick<CaptureSettings, 'gpsMaxAgeMs' | 'gpsTimeoutMs' | 'currentFixMaxAgeMs' | 'currentFixTimeoutMs'>;

export interface GpsListener {
  /** takenAtMs is when the GPS took the fix (coords timestamp), mapped onto the given clock. */
  readonly onFix: (fix: GpsFix, takenAtMs: number) => void;
  readonly onProblem: (problem: LocationProblem) => void;
}

/** Live high-accuracy fixes while the camera is open; a timeout just keeps waiting. */
export class GpsWatcher {
  readonly #geolocation: Geolocation | undefined;
  readonly #clock: Clock;
  readonly #timings: GpsTimings;

  constructor(geolocation: Geolocation | undefined, clock: Clock = new SystemClock(), timings: GpsTimings = CAPTURE_DEFAULTS) {
    this.#geolocation = geolocation;
    this.#clock = clock;
    this.#timings = timings;
  }

  /** Returns a function that stops watching. */
  watch({ onFix, onProblem }: GpsListener): () => void {
    const geolocation = this.#geolocation;
    if (!geolocation) {
      onProblem('unavailable');
      return () => undefined;
    }
    const id = geolocation.watchPosition(
      (position) => onFix(GpsWatcher.#fix(position.coords), this.#clock.now().getTime() - GpsWatcher.#ageMs(position)),
      (error) => {
        if (error.code === PERMISSION_DENIED) onProblem('denied');
        else if (error.code === POSITION_UNAVAILABLE) onProblem('unavailable');
      },
      { enableHighAccuracy: true, maximumAge: this.#timings.gpsMaxAgeMs, timeout: this.#timings.gpsTimeoutMs },
    );
    return () => geolocation.clearWatch(id);
  }

  /** How long ago a fix this watcher reported was taken, on the same clock as its takenAtMs. */
  ageMs(takenAtMs: number): number {
    return this.#clock.now().getTime() - takenAtMs;
  }

  /** One fresh high-accuracy fix, for a vote. */
  current(): Promise<GpsFix> {
    const geolocation = this.#geolocation;
    if (!geolocation) return Promise.reject(new LocationError('unavailable', 'No geolocation API'));
    return new Promise((resolve, reject) => {
      geolocation.getCurrentPosition(
        (position) => resolve(GpsWatcher.#fix(position.coords)),
        (error) => reject(new LocationError(error.code === PERMISSION_DENIED ? 'denied' : 'unavailable', error.message)),
        { enableHighAccuracy: true, maximumAge: this.#timings.currentFixMaxAgeMs, timeout: this.#timings.currentFixTimeoutMs },
      );
    });
  }

  static #fix(coords: GeolocationCoordinates): GpsFix {
    return { lat: coords.latitude, lon: coords.longitude, accuracy_m: Math.round(coords.accuracy * 10) / 10 };
  }

  // The age is measured on the wall clock the browser stamps fixes with, then applied to the recorder's clock. However
  // old, it stays old (CaptureFixWatch refuses it); a stamp from the future or none at all counts as just taken.
  static #ageMs(position: GeolocationPosition): number {
    const age = Date.now() - position.timestamp;
    return Number.isFinite(age) ? Math.max(age, 0) : 0;
  }
}
