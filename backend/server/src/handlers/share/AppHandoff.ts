import type { AppIntentUrl } from "../../domain/share/AppIntentUrl.js";
import { AndroidAppSettings } from "../../settings/AndroidAppSettings.js";
import { AndroidBrowser } from "./AndroidBrowser.js";
import { AppRedirect } from "./AppRedirect.js";
import type { ShareRedirect } from "./ShareRedirect.js";
import { WebRedirect } from "./WebRedirect.js";

// Picks the share page's redirect: the Android app first for an Android browser, else the web app.
export class AppHandoff {
  readonly #intents: AppIntentUrl;
  readonly #android = new AndroidBrowser();
  readonly #waitMs: number;

  constructor(intents: AppIntentUrl, waitMs = AndroidAppSettings.fromEnv({}).handoffWaitMs) {
    this.#intents = intents;
    this.#waitMs = waitMs;
  }

  redirect(webUrl: string, userAgent: string | undefined): ShareRedirect {
    const intent = this.#android.matches(userAgent) ? this.#intents.forWebUrl(webUrl) : null;
    return intent === null ? new WebRedirect(webUrl) : new AppRedirect(webUrl, intent, this.#waitMs);
  }
}
