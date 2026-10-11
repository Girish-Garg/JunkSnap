import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import type { WardScores } from "../src/contracts/index.gen.js";
import { EntityTag } from "../src/domain/EntityTag.js";
import { NotFoundError } from "../src/domain/errors.js";
import { areaScoresRoutes } from "../src/handlers/areaScoresRoutes.js";
import { createApp } from "../src/handlers/web.js";
import { AreaListQuery } from "../src/services/AreaListQuery.js";
import { AreaScoresQuery } from "../src/services/AreaScoresQuery.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";
import { InMemoryScores } from "./scores/InMemoryScores.js";
import { readContract } from "./scores/siteBuilder.js";
import { AREA_LIST } from "./defaults.js";

// Each body carries a counter, so a test can change what a route answers between requests.
const state = { version: 1 };
const OWNER = "me";

const stubRoutes: FastifyPluginAsync = async (app) => {
  app.get("/sites", async () => ({ type: "FeatureCollection", features: [{ version: state.version }] }));
  app.get("/sites/:id", async () => ({ site_id: "site_x", version: state.version }));
  app.get("/areas/:kind", async () => ({ areas: [], version: state.version }));
  app.get("/areas/:kind/:id/scores", async () => ({ counts: {}, version: state.version }));
  app.get("/areas/district/:id/crawl", async () => ({ status: "not_started", version: state.version }));
  const owned = async (request: { headers: Record<string, unknown> }) => {
    if (request.headers["x-owner"] !== OWNER) throw new NotFoundError("No such report");
    return { status: "queued", version: state.version };
  };
  app.get("/reports/:id", owned);
  app.get("/scans/:id", owned);
};

const ROUTES = [
  ["/sites?bbox=72.9,26.2,73.1,26.4", "no-cache"],
  ["/sites/site_x", "no-cache"],
  ["/areas/assembly?within=rajasthan-jodhpur", "no-cache"],
  ["/areas/assembly/s20-ac-127/scores", "no-cache"],
  ["/reports/rpt_x", "private, no-cache"],
  ["/scans/scn_x", "private, no-cache"],
] as const;
const AS_OWNER = { "x-owner": OWNER };

let app: FastifyInstance | undefined;

async function start(routes: FastifyPluginAsync = stubRoutes): Promise<FastifyInstance> {
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [routes], logger);
  return app;
}

afterEach(async () => {
  state.version = 1;
  await app?.close();
  app = undefined;
});

describe.each(ROUTES)("GET %s", (url, cacheControl) => {
  it("answers with an ETag of the body, then 304 with no body to a matching If-None-Match", async () => {
    const api = await start();
    const first = await api.inject({ url, headers: AS_OWNER });
    expect(first.statusCode).toBe(200);
    expect(first.headers.etag).toBe(EntityTag.ofBody(first.body).toHeader());
    expect(first.headers["cache-control"]).toBe(cacheControl);
    const again = await api.inject({ url, headers: { ...AS_OWNER, "if-none-match": String(first.headers.etag) } });
    expect(again.statusCode).toBe(304);
    expect(again.body).toBe("");
    expect(again.headers.etag).toBe(first.headers.etag);
    const weak = await api.inject({ url, headers: { ...AS_OWNER, "if-none-match": `"other", W/${String(first.headers.etag)}` } });
    expect(weak.statusCode).toBe(304);
  });

  it("answers 200 with the new body and a new ETag once the body changed", async () => {
    const api = await start();
    const first = await api.inject({ url, headers: AS_OWNER });
    state.version = 2;
    const changed = await api.inject({ url, headers: { ...AS_OWNER, "if-none-match": String(first.headers.etag) } });
    expect(changed.statusCode).toBe(200);
    expect(changed.body).toContain(`"version":2`);
    expect(changed.headers.etag).not.toBe(first.headers.etag);
  });
});

describe("conditional reads elsewhere", () => {
  it("never tags an owner-only read for someone else, even with the owner's ETag", async () => {
    const api = await start();
    const mine = await api.inject({ url: "/reports/rpt_x", headers: AS_OWNER });
    const theirs = await api.inject({ url: "/reports/rpt_x", headers: { "if-none-match": String(mine.headers.etag) } });
    expect(theirs.statusCode).toBe(404);
    expect(theirs.headers.etag).toBeUndefined();
  });

  it("leaves routes off the list, and errors, untagged", async () => {
    const api = await start();
    const crawl = await api.inject({ url: "/areas/district/rajasthan-jodhpur/crawl" });
    expect(crawl.statusCode).toBe(200);
    expect(crawl.headers.etag).toBeUndefined();
    expect((await api.inject({ url: "/healthz" })).headers.etag).toBeUndefined();
  });

  it("lets a browser on another origin read the ETag and send If-None-Match, with the preflight cached", async () => {
    const api = await start();
    const read = await api.inject({ url: "/sites/site_x", headers: { origin: "https://app.example.org" } });
    expect(read.headers["access-control-expose-headers"]).toBe("ETag");
    const preflight = await api.inject({
      method: "OPTIONS",
      url: "/sites/site_x",
      headers: { origin: "https://app.example.org", "access-control-request-method": "GET", "access-control-request-headers": "if-none-match" },
    });
    expect(String(preflight.headers["access-control-allow-headers"]).toLowerCase()).toContain("if-none-match");
    expect(preflight.headers["access-control-max-age"]).toBe("600");
  });
});

describe("GET /areas/{kind} with the real route", () => {
  it("answers 304 to the ETag of the stored listing", async () => {
    const scores = new InMemoryScores();
    await scores.save(readContract<WardScores>("fixtures/ward_scores.jdh-1.json"), ["rajasthan-jodhpur", "jodhpur-mc"]);
    const api = await start(areaScoresRoutes({ scores: new AreaScoresQuery(scores), list: new AreaListQuery(scores, AREA_LIST) }));
    const url = "/areas/assembly?within=rajasthan-jodhpur";
    const first = await api.inject({ url });
    expect(first.json().total).toBe(1);
    const again = await api.inject({ url, headers: { "if-none-match": String(first.headers.etag) } });
    expect(again.statusCode).toBe(304);
  });
});

describe("EntityTag", () => {
  it("matches only its own tag, a weak copy of it, or *", () => {
    const tag = EntityTag.ofBody('{"a":1}');
    expect(tag.matchedBy(tag.toHeader())).toBe(true);
    expect(tag.matchedBy("*")).toBe(true);
    expect(tag.matchedBy([`"x"`, `W/${tag.toHeader()}`])).toBe(true);
    expect(tag.matchedBy(EntityTag.ofBody('{"a":2}').toHeader())).toBe(false);
    expect(tag.matchedBy(undefined)).toBe(false);
  });
});
