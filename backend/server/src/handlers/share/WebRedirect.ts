import { jsString, type ShareLink, type ShareRedirect } from "./ShareRedirect.js";

// Straight on to the web app page (every reader that is not an Android browser).
export class WebRedirect implements ShareRedirect {
  readonly script: string;
  readonly links: readonly ShareLink[];

  constructor(webUrl: string) {
    this.script = `location.replace(${jsString(webUrl)});`;
    this.links = [{ href: webUrl, label: "Open in JunkSnap" }];
  }
}
