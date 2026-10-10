const ANDROID = /\bAndroid\b/;
// An app's own WebView ("; wv)" in the user agent) cannot open intent:// links, and crawlers only read the tags.
const WEBVIEW = /;\s*wv\)/;
const CRAWLER = /bot\b|crawler|spider|facebookexternalhit|WhatsApp|Slack|Discord|preview/i;

// A browser on Android that can follow an intent:// link: Chrome, Samsung Internet, Firefox, Edge, and the Custom Tabs
// that chat apps open links in.
export class AndroidBrowser {
  matches(userAgent: string | undefined): boolean {
    if (userAgent === undefined) return false;
    return ANDROID.test(userAgent) && !WEBVIEW.test(userAgent) && !CRAWLER.test(userAgent);
  }
}
