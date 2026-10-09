import { LocationError } from '../domain/LocationError';
import type { LonLat } from '../domain/Site';

const PERMISSION_DENIED = 1;
const TIMEOUT_MS = 10_000;

export class GeoLocator {
  readonly #geolocation: Geolocation | undefined;

  constructor(geolocation: Geolocation | undefined) {
    this.#geolocation = geolocation;
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
