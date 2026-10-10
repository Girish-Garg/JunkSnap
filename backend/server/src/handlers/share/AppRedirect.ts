import { jsString, type ShareLink, type ShareRedirect } from "./ShareRedirect.js";

// How long the page waits for the app to come up before it opens the web app instead.
const WAIT_MS = 2000;

// Android browsers: try the app first through its intent:// link. Installed, the app opens and the page is hidden,
// which cancels the timer. Not installed, the browser follows the intent's browser_fallback_url to the web app. If the
// browser ignores the intent (some refuse one without a tap), the timer opens the web app.
export class AppRedirect implements ShareRedirect {
  readonly script: string;
  readonly links: readonly ShareLink[];

  constructor(webUrl: string, intentUrl: string) {
    this.script = [
      `var web=${jsString(webUrl)};`,
      `var wait=setTimeout(function(){location.replace(web);},${WAIT_MS});`,
      'document.addEventListener("visibilitychange",function(){clearTimeout(wait);});',
      `location.replace(${jsString(intentUrl)});`,
    ].join("");
    this.links = [
      { href: intentUrl, label: "Open in the JunkSnap app" },
      { href: webUrl, label: "Open in the browser" },
    ];
  }
}
