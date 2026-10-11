import { CAPTURE_DEFAULTS, type CaptureSettings } from '../config/CaptureSettings';
import { LocationError } from '../domain/LocationError';
import type { LonLat } from '../domain/Site';

const PERMISSION_DENIED = 1;

/** The map's "where am I" fix: getCurrentPosition maximumAge and timeout. */
export type LocateTimings = Pick<CaptureSettings, 'locateMaxAgeMs' | 'locateTimeoutMs'>;

/** The one Permissions API call the quiet locate needs; absent in old browsers and in tests. */
export type PermissionQuery = Pick<Permissions, 'query'>;

export class GeoLocator {
  readonly #geolocation: Geolocation | undefined;
  readonly #permissions: PermissionQuery | undefined;
  readonly #timings: LocateTimings;

  constructor(geolocation: Geolocation | undefined, permissions?: PermissionQuery, timings: LocateTimings = CAPTURE_DEFAULTS) {
    this.#geolocation = geolocation;
    this.#permissions = permissions;
    this.#timings = timings;
  }

  /** Whether locateIfAllowed can ever find a fix: it needs both the location and the Permissions APIs. */
  canLocateQuietly(): boolean {
    return this.#geolocation !== undefined && this.#permissions !== undefined;
  }

  /**
   * A fix only when location is already allowed, so opening the app never asks. Null when it is not allowed
   * yet, blocked, or cannot be read; the map then stays on the pilot city.
   */
  async locateIfAllowed(): Promise<LonLat | null> {
    try {
      const status = await this.#permissions?.query({ name: 'geolocation' });
      return status?.state === 'granted' ? await this.locate() : null;
    } catch {
      return null;
    }
  }

  locate(): Promise<LonLat> {
    const geolocation = this.#geolocation;
    if (!geolocation) return Promise.reject(new LocationError('unavailable', 'No geolocation API'));
    return new Promise((resolve, reject) => {
      geolocation.getCurrentPosition(
        ({ coords }) => resolve([coords.longitude, coords.latitude]),
        (error) => reject(GeoLocator.#translate(error)),
        { enableHighAccuracy: true, timeout: this.#timings.locateTimeoutMs, maximumAge: this.#timings.locateMaxAgeMs },
      );
    });
  }

  static #translate(error: GeolocationPositionError): LocationError {
    const problem = error.code === PERMISSION_DENIED ? 'denied' : 'unavailable';
    return new LocationError(problem, error.message);
  }
}
