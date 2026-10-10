/** The global Tauri API, present only inside the Android app (apps/android-tauri, withGlobalTauri). */
interface TauriApi {
  readonly core: { invoke(command: string, args?: Record<string, unknown>): Promise<unknown> };
}

/** The app's native methods (MainActivity.kt); the Android WebView ignores window.print(). */
interface AndroidApi {
  print(): void;
  openAppSettings(): void;
}

export interface NativeHost {
  readonly __TAURI__?: TauriApi;
  readonly JunkSnapAndroid?: AndroidApi;
  print(): void;
}

// Android's share chooser reports "cancelled" even after the resident picked an app.
const SHARE_CLOSED = /cancel/i;

/** Print, share and app settings inside the Android app; the browser's own print elsewhere. */
export class NativeBridge {
  readonly #host: NativeHost;

  constructor(host: NativeHost) {
    this.#host = host;
  }

  /** The native share sheet exists only inside the app. */
  canShareText(): boolean {
    return this.#host.__TAURI__ !== undefined;
  }

  /** Inside the app, a blocked camera or location is allowed again in the app's settings. */
  canOpenAppSettings(): boolean {
    return this.#host.JunkSnapAndroid !== undefined;
  }

  openAppSettings(): void {
    this.#host.JunkSnapAndroid?.openAppSettings();
  }

  /** The system print dialog, which offers Save as PDF. */
  print(): void {
    if (this.#host.JunkSnapAndroid) this.#host.JunkSnapAndroid.print();
    else this.#host.print();
  }

  async shareText(text: string): Promise<void> {
    const tauri = this.#host.__TAURI__;
    if (!tauri) throw new Error('No native share sheet here');
    try {
      await tauri.core.invoke('plugin:sharekit|share_text', { text });
    } catch (error) {
      if (!SHARE_CLOSED.test(String(error))) throw error;
    }
  }
}
