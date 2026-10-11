import { LocationError } from '../domain/LocationError';
import type { LonLat } from '../domain/Site';

const PERMISSION_DENIED = 1;
const TIMEOUT_MS = 10_000;

/** The one Permissions API call the quiet locate needs; absent in old browsers and in tests. */
export type PermissionQuery = Pick<Permissions, 'query'>;

export class GeoLocator {
  readonly #geolocation: Geolocation | undefined;
  readonly #permissions: PermissionQuery | undefined;

  constructor(geolocation: Geolocation | undefined, permissions?: PermissionQuery) {
    this.#geolocation = geolocation;
    this.#permissions = permissions;
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
        { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 60_000 },
      );
    });
  }

  static #translate(error: GeolocationPositionError): LocationError {
    const problem = error.code === PERMISSION_DENIED ? 'denied' : 'unavailable';
    return new LocationError(problem, error.message);
  }
}
