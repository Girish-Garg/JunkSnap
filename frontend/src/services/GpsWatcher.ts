import type { LocationProblem } from '../domain/LocationError';
import type { GpsFix } from '../domain/ReportUpload';

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 };

export interface GpsListener {
  readonly onFix: (fix: GpsFix) => void;
  readonly onProblem: (problem: LocationProblem) => void;
}

/** Live high-accuracy fixes while the camera is open; a timeout just keeps waiting. */
export class GpsWatcher {
  readonly #geolocation: Geolocation | undefined;

  constructor(geolocation: Geolocation | undefined) {
    this.#geolocation = geolocation;
  }

  /** Returns a function that stops watching. */
  watch({ onFix, onProblem }: GpsListener): () => void {
    const geolocation = this.#geolocation;
    if (!geolocation) {
      onProblem('unavailable');
      return () => undefined;
    }
    const id = geolocation.watchPosition(
      ({ coords }) => onFix({ lat: coords.latitude, lon: coords.longitude, accuracy_m: Math.round(coords.accuracy * 10) / 10 }),
      (error) => {
        if (error.code === PERMISSION_DENIED) onProblem('denied');
        else if (error.code === POSITION_UNAVAILABLE) onProblem('unavailable');
      },
      OPTIONS,
    );
    return () => geolocation.clearWatch(id);
  }
}
