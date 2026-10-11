import { jsString, type ShareLink, type ShareRedirect } from "./ShareRedirect.js";

// Android browsers: try the app first through its intent:// link. Installed, the app opens and the page is hidden,
// which cancels the timer. Not installed, the browser follows the intent's browser_fallback_url to the web app. If the
// browser ignores the intent (some refuse one without a tap), the timer opens the web app.
export class AppRedirect implements ShareRedirect {
  readonly script: string;
  readonly links: readonly ShareLink[];

  // waitMs: how long the page waits for the app to come up before it opens the web app instead (ANDROID_HANDOFF_WAIT_MS).
  constructor(webUrl: string, intentUrl: string, waitMs: number) {
    this.script = [
      `var web=${jsString(webUrl)};`,
      `var wait=setTimeout(function(){location.replace(web);},${waitMs});`,
      'document.addEventListener("visibilitychange",function(){clearTimeout(wait);});',
      `location.replace(${jsString(intentUrl)});`,
    ].join("");
    this.links = [
      { href: intentUrl, label: "Open in the JunkSnap app" },
      { href: webUrl, label: "Open in the browser" },
    ];
  }
}
