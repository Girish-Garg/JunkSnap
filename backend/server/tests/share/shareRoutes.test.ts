import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import type { WardScores } from "../../src/contracts/index.gen.js";
import { AreaNotFoundError } from "../../src/domain/AreaNotFoundError.js";
import { AreaCardWriter } from "../../src/domain/share/AreaCardWriter.js";
import { ShareUrls } from "../../src/domain/share/ShareUrls.js";
import { SiteCardWriter } from "../../src/domain/share/SiteCardWriter.js";
import { SiteNotFoundError } from "../../src/domain/sites/SiteErrors.js";
import type { SiteFeature } from "../../src/domain/sites/SiteTypes.js";
import { CheckedSiteSource } from "../../src/handlers/share/CheckedSiteSource.js";
import { ShareRoutes } from "../../src/handlers/share/ShareRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import type { ShareAreaSource, ShareSiteSource } from "../../src/ports/share/ShareSources.js";
import { AreaScoresQuery } from "../../src/services/AreaScoresQuery.js";
import { ShareCardService } from "../../src/services/share/ShareCardService.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { InMemoryScores } from "../scores/InMemoryScores.js";
import { BASE_URL, fixture, siteFixture } from "../sites/builders.js";

const WEB = "https://demo.example.amplifyapp.com";
const LOGO = `${WEB}/brand/icon-512.png`;
const ORIGINAL = "https://junksnap-dev-originals-123456789012.s3.ap-south-1.amazonaws.com/reports/upl_jdh_1.jpg";

class MapSites implements ShareSiteSource {
  readonly #sites: Map<string, SiteFeature>;

  constructor(sites: readonly SiteFeature[]) {
    this.#sites = new Map(sites.map((site) => [site.properties.site_id, site]));
  }

  async byId(siteId: string): Promise<SiteFeature> {
    const site = this.#sites.get(siteId);
    if (site === undefined) throw new SiteNotFoundError(`No site ${siteId}`);
    return site;
  }
}

class FailingSource implements ShareSiteSource, ShareAreaSource {
  async byId(): Promise<SiteFeature> {
    throw new Error("table junksnap-dev-sites is unreachable");
  }

  async find(): Promise<WardScores> {
    throw new AreaNotFoundError("none");
  }
}

function withProps(sample: string, props: Partial<SiteFeature["properties"]>): SiteFeature {
  const site = siteFixture(sample);
  return { ...site, properties: { ...site.properties, ...props } };
}

let app: FastifyInstance | undefined;

async function start(sites: ShareSiteSource, rows: readonly WardScores[] = []): Promise<FastifyInstance> {
  const urls = new ShareUrls({ publicBaseUrl: BASE_URL, webUrl: `${WEB}/` });
  const scores = new InMemoryScores();
  for (const row of rows) await scores.save(row);
  const cards = new ShareCardService({
    sites: new CheckedSiteSource(sites),
    areas: new AreaScoresQuery(scores),
    siteCards: new SiteCardWriter(urls),
    areaCards: new AreaCardWriter(urls),
  });
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [new ShareRoutes(cards).plugin()], logger);
  return app;
}

function meta(html: string, name: string): string | undefined {
  const tag = new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)">`).exec(html);
  return tag?.[1];
}

async function page(url: string, sites: readonly SiteFeature[] = [], rows: readonly WardScores[] = []) {
  const response = await (await start(new MapSites(sites), rows)).inject({ url });
  return { response, html: response.body };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /share/sites/{id}", () => {
  it("shows an open site's blurred photo, place, progress and date, then sends people to the app", async () => {
    const { response, html } = await page("/share/sites/site_jpr_1", [siteFixture("jpr-1")]);
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(meta(html, "og:title")).toBe("Open construction · Malviya Nagar, Jaipur");
    expect(meta(html, "og:description")).toBe("2 of 10 people confirmed · reported 10 Oct");
    expect(meta(html, "og:image")).toBe(`${BASE_URL}/media/reports/rpt_jpr_1.jpg`);
    expect(meta(html, "twitter:card")).toBe("summary_large_image");
    expect(meta(html, "og:url")).toBe(`${BASE_URL}/share/sites/site_jpr_1`);
    expect(html).toContain(`location.replace("${WEB}/sites/site_jpr_1");`);
    expect(html).toContain(`<a href="${WEB}/sites/site_jpr_1">Open in JunkSnap</a>`);
  });

  it("says verified only for a site 10 people backed, and allows only its own script", async () => {
    const { response, html } = await page("/share/sites/site_jdh_2", [siteFixture("jdh-2")]);
    expect(meta(html, "og:title")).toBe("No bin or pickup · Sardarpura, Jodhpur");
    expect(meta(html, "og:description")).toBe("Verified by 10 people · reported 9 Oct");
    const script = /<script>(.*)<\/script>/.exec(html)?.[1] ?? "";
    const hash = createHash("sha256").update(script).digest("base64");
    expect(response.headers["content-security-policy"]).toContain(`script-src 'sha256-${hash}'`);
  });

  it.each([
    ["removed", { status: "removed" as const }],
    ["expired", { status: "expired" as const }],
    ["rejected", { verification: "rejected" as const }],
  ])("shows a generic card with no photo for a %s site", async (_name, props) => {
    const site = withProps("jdh-1", props);
    const { response, html } = await page("/share/sites/site_jdh_1", [site]);
    expect(response.statusCode).toBe(200);
    expect(meta(html, "og:title")).toBe("A waste report on JunkSnap");
    expect(meta(html, "og:image")).toBe(LOGO);
    expect(meta(html, "twitter:card")).toBe("summary");
    expect(html).not.toContain("/media/");
    expect(html).not.toContain("Jodhpur");
  });

  it.each(["site_unknown", "<script>alert(1)</script>", "site_%22%3E%3Cb%3E"])("answers 404 with the generic card for %s", async (id) => {
    const { response, html } = await page(`/share/sites/${encodeURIComponent(id)}`, [siteFixture("jdh-1")]);
    expect(response.statusCode).toBe(404);
    expect(meta(html, "og:title")).toBe("JunkSnap");
    expect(meta(html, "og:image")).toBe(LOGO);
    expect(html).toContain(`location.replace("${WEB}/");`);
    expect(html).not.toMatch(/<script>alert|<b>|"><b/);
  });

  it("escapes every piece of text from the site", async () => {
    const hostile = `Jodhpur "</title><script>alert('x')</script>&`;
    const site = withProps("jdh-1", { location: { ...siteFixture("jdh-1").properties.location, town: hostile } });
    const { html } = await page("/share/sites/site_jdh_1", [site]);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("</title><script>");
    expect(meta(html, "og:title")).toBe("Waste dump · Jodhpur, Jodhpur &quot;&lt;/title&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;");
    expect(html.match(/<script>/g)).toHaveLength(1);
  });

  it("never uses an original or any URL that is not a public blurred copy", async () => {
    const urls: [string, string, string, string] = [ORIGINAL, "https://evil.example/media/reports/rpt_jdh_1.jpg", `${BASE_URL}/media/cleanups/cln_jdh_3c.jpg`, `${BASE_URL}/reports/upl_jdh_1.jpg`];
    const { html } = await page("/share/sites/site_jdh_1", [withProps("jdh-1", { photo_urls: urls })]);
    expect(meta(html, "og:image")).toBe(LOGO);
    expect(html).not.toMatch(/originals|amazonaws|evil\.example|upl_|cln_/);
  });

  it("skips an unsafe photo for the next blurred copy", async () => {
    const blurred = `${BASE_URL}/media/reports/rpt_jdh_1a.jpg`;
    const { html } = await page("/share/sites/site_jdh_1", [withProps("jdh-1", { photo_urls: [ORIGINAL, blurred] })]);
    expect(meta(html, "og:image")).toBe(blurred);
    expect(html).not.toContain("originals");
  });

  it("keeps other failures as a 500", async () => {
    const response = await (await start(new FailingSource())).inject({ url: "/share/sites/site_jdh_1" });
    expect(response.statusCode).toBe(500);
  });

  it("answers HEAD for crawlers that check first", async () => {
    const response = await (await start(new MapSites([siteFixture("jdh-1")]))).inject({ method: "HEAD", url: "/share/sites/site_jdh_1" });
    expect(response.statusCode).toBe(200);
  });
});

describe("GET /share/areas/{kind}/{id}", () => {
  const scores = fixture<WardScores>("ward_scores.jdh-1.json");

  it("shows the area's counts and the logo", async () => {
    const { response, html } = await page("/share/areas/assembly/s20-ac-128", [], [scores]);
    expect(response.statusCode).toBe(200);
    expect(meta(html, "og:title")).toBe("Jodhpur assembly seat · JunkSnap area report");
    expect(meta(html, "og:description")).toBe("14 verified reports · 6 sites · Pilot city");
    expect(meta(html, "og:image")).toBe(LOGO);
    expect(html).toContain(`location.replace("${WEB}/areas/assembly/s20-ac-128");`);
  });

  it("says when there are not enough verified reports", async () => {
    const few = fixture<WardScores>("ward_scores.jpr-1.json");
    const { html } = await page("/share/areas/assembly/s20-ac-54", [], [few]);
    expect(meta(html, "og:description")).toBe("Not enough verified reports yet (0 of 10) · 1 site");
  });

  it.each(["/share/areas/assembly/s20-ac-999", "/share/areas/planet/earth", "/share/areas/ward/%3Cb%3E"])("answers 404 with the generic card for %s", async (url) => {
    const { response, html } = await page(url, [], [scores]);
    expect(response.statusCode).toBe(404);
    expect(meta(html, "og:title")).toBe("JunkSnap");
    expect(html).not.toContain("<b>");
  });
});
