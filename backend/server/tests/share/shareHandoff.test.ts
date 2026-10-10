import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import type { WardScores } from "../../src/contracts/index.gen.js";
import { AppIntentUrl } from "../../src/domain/share/AppIntentUrl.js";
import { AreaCardWriter } from "../../src/domain/share/AreaCardWriter.js";
import { ShareUrls } from "../../src/domain/share/ShareUrls.js";
import { SiteCardWriter } from "../../src/domain/share/SiteCardWriter.js";
import { SiteNotFoundError } from "../../src/domain/sites/SiteErrors.js";
import type { SiteFeature } from "../../src/domain/sites/SiteTypes.js";
import { AndroidBrowser } from "../../src/handlers/share/AndroidBrowser.js";
import { AppHandoff } from "../../src/handlers/share/AppHandoff.js";
import { CheckedSiteSource } from "../../src/handlers/share/CheckedSiteSource.js";
import { ShareRoutes } from "../../src/handlers/share/ShareRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import type { ShareSiteSource } from "../../src/ports/share/ShareSources.js";
import { AreaScoresQuery } from "../../src/services/AreaScoresQuery.js";
import { ShareCardService } from "../../src/services/share/ShareCardService.js";
import { ANDROID_PACKAGE } from "../../src/settings/AndroidAppSettings.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { InMemoryScores } from "../scores/InMemoryScores.js";
import { BASE_URL, fixture, siteFixture } from "../sites/builders.js";

const WEB = "https://demo.example.amplifyapp.com";
const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const GOOGLEBOT = "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const SITE_INTENT = `intent://sites/site_jdh_1#Intent;scheme=junksnap;package=com.junksnap.app;S.browser_fallback_url=${encodeURIComponent(`${WEB}/sites/site_jdh_1`)};end`;

class OneSite implements ShareSiteSource {
  async byId(siteId: string): Promise<SiteFeature> {
    if (siteId !== "site_jdh_1") throw new SiteNotFoundError(`No site ${siteId}`);
    return siteFixture("jdh-1");
  }
}

let app: FastifyInstance | undefined;

async function get(url: string, userAgent?: string) {
  const urls = new ShareUrls({ publicBaseUrl: BASE_URL, webUrl: WEB });
  const scores = new InMemoryScores();
  await scores.save(fixture<WardScores>("ward_scores.jdh-1.json"));
  const cards = new ShareCardService({
    sites: new CheckedSiteSource(new OneSite()),
    areas: new AreaScoresQuery(scores),
    siteCards: new SiteCardWriter(urls),
    areaCards: new AreaCardWriter(urls),
  });
  const routes = new ShareRoutes(cards, new AppHandoff(new AppIntentUrl(ANDROID_PACKAGE)));
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [routes.plugin()], logger);
  const response = await app.inject({ url, headers: userAgent === undefined ? {} : { "user-agent": userAgent } });
  return { response, html: response.body };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("AppIntentUrl", () => {
  const intents = new AppIntentUrl(ANDROID_PACKAGE);

  it("opens the matching app page and falls back to the encoded web URL", () => {
    expect(intents.forWebUrl(`${WEB}/sites/site_jdh_1`)).toBe(SITE_INTENT);
    expect(intents.forWebUrl(`${WEB}/areas/assembly/s20-ac-128`)).toBe(
      "intent://areas/assembly/s20-ac-128#Intent;scheme=junksnap;package=com.junksnap.app;" +
        "S.browser_fallback_url=https%3A%2F%2Fdemo.example.amplifyapp.com%2Fareas%2Fassembly%2Fs20-ac-128;end",
    );
  });

  it("keeps an encoded id encoded, so it cannot end the intent early", () => {
    const intent = intents.forWebUrl(`${WEB}/sites/${encodeURIComponent("a;end#Intent;b")}`) ?? "";
    expect(intent.startsWith("intent://sites/a%3Bend%23Intent%3Bb#Intent;")).toBe(true);
    expect(intent.match(/;end/g)).toHaveLength(1);
    expect(intent).toContain("S.browser_fallback_url=https%3A%2F%2Fdemo.example.amplifyapp.com%2Fsites%2Fa%253Bend%2523Intent%253Bb;end");
  });

  it("has nothing to open for the web app's home page", () => {
    expect(intents.forWebUrl(`${WEB}/`)).toBeNull();
  });
});

describe("AndroidBrowser", () => {
  it.each([
    [CHROME, true],
    ["Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36", true],
    ["Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0", true],
    [WEBVIEW, false],
    [GOOGLEBOT, false],
    ["WhatsApp/2.24.1 A", false],
    [IPHONE, false],
    [DESKTOP, false],
    [undefined, false],
  ])("%s -> %s", (userAgent, expected) => {
    expect(new AndroidBrowser().matches(userAgent)).toBe(expected);
  });
});

describe("share page on Android", () => {
  it("tries the app through the intent URL, then the web app, and allows only that script", async () => {
    const { response, html } = await get("/share/sites/site_jdh_1", CHROME);
    expect(response.statusCode).toBe(200);
    expect(html).toContain(`location.replace("${SITE_INTENT}");`);
    expect(html).toContain(`var web="${WEB}/sites/site_jdh_1";`);
    expect(html).toContain(`<a href="${SITE_INTENT}">Open in the JunkSnap app</a>`);
    expect(html).toContain(`<a href="${WEB}/sites/site_jdh_1">Open in the browser</a>`);
    const script = /<script>(.*)<\/script>/.exec(html)?.[1] ?? "";
    const hash = createHash("sha256").update(script).digest("base64");
    expect(response.headers["content-security-policy"]).toContain(`script-src 'sha256-${hash}'`);
    expect(response.headers.vary).toBe("User-Agent");
  });

  it("keeps the same link preview tags for every reader", async () => {
    const tags = (html: string) => html.match(/<meta [^>]+>|<link [^>]+>|<title>.*<\/title>/g);
    const android = await get("/share/sites/site_jdh_1", CHROME);
    const desktop = await get("/share/sites/site_jdh_1", DESKTOP);
    expect(tags(android.html)).toEqual(tags(desktop.html));
    expect(tags(android.html)?.length).toBeGreaterThan(10);
  });

  it.each([IPHONE, DESKTOP, WEBVIEW, GOOGLEBOT, undefined])("sends %s straight to the web app", async (userAgent) => {
    const { html } = await get("/share/sites/site_jdh_1", userAgent);
    expect(html).not.toContain("intent:");
    expect(html).toContain(`location.replace("${WEB}/sites/site_jdh_1");`);
    expect(html).toContain(`<a href="${WEB}/sites/site_jdh_1">Open in JunkSnap</a>`);
  });

  it("sends an unknown site to the web app's home, not the app", async () => {
    const { response, html } = await get("/share/sites/site_unknown", CHROME);
    expect(response.statusCode).toBe(404);
    expect(html).not.toContain("intent:");
    expect(html).toContain(`location.replace("${WEB}/");`);
  });

  it("opens an area in the app", async () => {
    const { html } = await get("/share/areas/assembly/s20-ac-128", CHROME);
    expect(html).toContain('location.replace("intent://areas/assembly/s20-ac-128#Intent;scheme=junksnap;package=com.junksnap.app;');
  });

  it("escapes the intent URL in the link and the script", async () => {
    const { html } = await get(`/share/sites/${encodeURIComponent('site_"<b>')}`, CHROME);
    expect(html).not.toMatch(/<b>|"<b/);
  });
});
