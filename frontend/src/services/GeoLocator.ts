import { CAPTURE_DEFAULTS, type CaptureSettings } from '../config/CaptureSettings';
import { LocationError, type LocationProblem } from '../domain/LocationError';
import type { LonLat } from '../domain/Site';

// GeolocationPositionError codes: PERMISSION_DENIED 1, POSITION_UNAVAILABLE 2 (the phone's location is off), TIMEOUT 3.
const PROBLEMS: Readonly<Partial<Record<number, LocationProblem>>> = { 1: 'denied', 3: 'timeout' };

/** The map's "where am I" fix: getCurrentPosition maximumAge and timeout. */
export type LocateTimings = Pick<CaptureSettings, 'locateMaxAgeMs' | 'locateTimeoutMs'>;

/** The one Permissions API call the quiet locate needs; absent in old browsers and in tests. */
export type PermissionQuery = Pick<Permissions, 'query'>;

export class GeoLocator {
  readonly #geolocation: Geolocation | undefined;
  readonly #permissions: PermissionQuery | undefined;
  readonly #timings: LocateTimings;
  // When the app got each fix it handed out, so a fix passed on as a plain LonLat (the map's) keeps its real age.
  readonly #taken = new WeakMap<LonLat, number>();

  constructor(geolocation: Geolocation | undefined, permissions?: PermissionQuery, timings: LocateTimings = CAPTURE_DEFAULTS) {
    this.#geolocation = geolocation;
    this.#permissions = permissions;
    this.#timings = timings;
  }

  /** Whether this browser has the location API at all. */
  canLocate(): boolean {
    return this.#geolocation !== undefined;
  }

  /** Whether locateIfAllowed can ever find a fix: it needs both the location and the Permissions APIs. */
  canLocateQuietly(): boolean {
    return this.#geolocation !== undefined && this.#permissions !== undefined;
  }

  /**
   * A fix only when location is already allowed, so this read never asks (StartupLocation may, once). Null when it
   * is not allowed yet, blocked, or cannot be read; the map then stays on the pilot city.
   */
  async locateIfAllowed(): Promise<LonLat | null> {
    try {
      const status = await this.#permissions?.query({ name: 'geolocation' });
      return status?.state === 'granted' ? await this.locate() : null;
    } catch {
      return null;
    }
  }

  /** When the app got this fix from locate() (Date.now() ms), or null for a point it did not hand out. */
  takenMs(at: LonLat): number | null {
    return this.#taken.get(at) ?? null;
  }

  locate(): Promise<LonLat> {
    const geolocation = this.#geolocation;
    if (!geolocation) return Promise.reject(new LocationError('unavailable', 'No geolocation API'));
    return new Promise((resolve, reject) => {
      geolocation.getCurrentPosition(
        ({ coords }) => resolve(this.#stamped([coords.longitude, coords.latitude])),
        (error) => reject(GeoLocator.#translate(error)),
        { enableHighAccuracy: true, timeout: this.#timings.locateTimeoutMs, maximumAge: this.#timings.locateMaxAgeMs },
      );
    });
  }

  #stamped(at: LonLat): LonLat {
    this.#taken.set(at, Date.now());
    return at;
  }

  static #translate(error: GeolocationPositionError): LocationError {
    return new LocationError(PROBLEMS[error.code] ?? 'unavailable', error.message);
  }
}
