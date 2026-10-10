/** The global Tauri API, present only inside the Android app (apps/android-tauri, withGlobalTauri). */
interface TauriApi {
  readonly core: { invoke(command: string, args?: Record<string, unknown>): Promise<unknown> };
}

/** The app's one native print method (MainActivity.kt); the Android WebView ignores window.print(). */
interface PrintApi {
  print(): void;
}

export interface NativeHost {
  readonly __TAURI__?: TauriApi;
  readonly JunkSnapPrint?: PrintApi;
  print(): void;
}

// Android's share chooser reports "cancelled" even after the resident picked an app.
const SHARE_CLOSED = /cancel/i;

/** Print and share inside the Android app; the browser's own print everywhere else. */
export class NativeBridge {
  readonly #host: NativeHost;

  constructor(host: NativeHost) {
    this.#host = host;
  }

  /** The native share sheet exists only inside the app. */
  canShareText(): boolean {
    return this.#host.__TAURI__ !== undefined;
  }

  /** The system print dialog, which offers Save as PDF. */
  print(): void {
    if (this.#host.JunkSnapPrint) this.#host.JunkSnapPrint.print();
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
