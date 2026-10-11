import type { PermissionQuery } from './GeoLocator';
import type { LocationPermissionSource } from './LocationAccess';

/** The browser's Permissions API; it cannot tell where the API is missing or does not know geolocation. */
export class BrowserLocationPermission implements LocationPermissionSource {
  readonly #permissions: PermissionQuery | undefined;

  constructor(permissions: PermissionQuery | undefined) {
    this.#permissions = permissions;
  }

  async read(): Promise<PermissionState | null> {
    return (await this.#status())?.state ?? null;
  }

  /** The status's change event: the person allowed or blocked location in the page's settings while it is open. */
  watch(onChange: () => void): () => void {
    let status: PermissionStatus | null = null;
    let live = true;
    void this.#status().then((found) => {
      if (!live || !found) return;
      status = found;
      found.addEventListener('change', onChange);
    });
    return () => {
      live = false;
      status?.removeEventListener('change', onChange);
    };
  }

  async #status(): Promise<PermissionStatus | null> {
    try {
      return (await this.#permissions?.query({ name: 'geolocation' })) ?? null;
    } catch {
      return null;
    }
  }
}
