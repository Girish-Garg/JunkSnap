import type { LocationPermissionSource } from './LocationAccess';

/** The event MainActivity.kt dispatches on window after checkLocation(), with whether Android allows location as `detail`. */
export const LOCATION_EVENT = 'junksnap:location';

/** The page's window inside the Android app; checkLocation is missing in app builds before it. */
export interface AppLocationHost {
  addEventListener(type: string, listener: (event: Event) => void, options?: AddEventListenerOptions): void;
  readonly JunkSnapAndroid?: { checkLocation?(): void };
}

/**
 * Inside the Android app the WebView never reports the app's location permission (it answers prompt, and denied on
 * WebViews before 2024), so the app is asked instead. "Not allowed" may mean never asked, so it cannot tell then. An
 * app build without checkLocation cannot tell at all: it answers prompt, so a denial the page learned is forgotten
 * and the next tap asks Android again, which answers at once when the person allowed it in the settings.
 */
export class AppLocationPermission implements LocationPermissionSource {
  readonly #host: AppLocationHost;

  constructor(host: AppLocationHost) {
    this.#host = host;
  }

  read(): Promise<PermissionState | null> {
    const android = this.#host.JunkSnapAndroid;
    if (!android?.checkLocation) return Promise.resolve('prompt');
    return new Promise((resolve) => {
      const onAnswer = (event: Event) => resolve(event instanceof CustomEvent && event.detail === true ? 'granted' : null);
      this.#host.addEventListener(LOCATION_EVENT, onAnswer, { once: true });
      android.checkLocation?.();
    });
  }

  // Android tells the app nothing while it runs; the page asks again when it comes back on screen.
  watch(): () => void {
    return () => undefined;
  }
}
