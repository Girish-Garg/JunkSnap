import type { AppIntentUrl } from "../../domain/share/AppIntentUrl.js";
import { AndroidBrowser } from "./AndroidBrowser.js";
import { AppRedirect } from "./AppRedirect.js";
import type { ShareRedirect } from "./ShareRedirect.js";
import { WebRedirect } from "./WebRedirect.js";

// Picks the share page's redirect: the Android app first for an Android browser, else the web app.
export class AppHandoff {
  readonly #intents: AppIntentUrl;
  readonly #android = new AndroidBrowser();

  constructor(intents: AppIntentUrl) {
    this.#intents = intents;
  }

  redirect(webUrl: string, userAgent: string | undefined): ShareRedirect {
    const intent = this.#android.matches(userAgent) ? this.#intents.forWebUrl(webUrl) : null;
    return intent === null ? new WebRedirect(webUrl) : new AppRedirect(webUrl, intent);
  }
}
