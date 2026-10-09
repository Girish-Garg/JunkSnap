import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { validateSite } from "../../src/contracts/index.gen.js";
import type { SiteFeature } from "../../src/domain/sites/SiteTypes.js";
import { SiteRoutes } from "../../src/handlers/sites/SiteRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import { CleanupIntake } from "../../src/services/sites/CleanupIntake.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { VoteService } from "../../src/services/sites/VoteService.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { DEVICE_A, DEVICE_B, siteFixture } from "./builders.js";
import { FakeCleanups, FakeDevices, FakeQueue, FakeReportStatus, FakeSiteRepository, FakeVoteRepository, FixedClock } from "./fakes.js";

const JODHPUR = "72.9,26.2,73.1,26.4";
const VOTE = { device_token: DEVICE_B, vote: "confirm", gps: { lat: 26.853, lon: 75.815, accuracy_m: 10 } };
const CLEANUP = {
  upload_id: "upl_jdh_1c",
  device_token: DEVICE_B,
  sha256: "b".repeat(64),
  gps: { lat: 26.2619, lon: 73.0035, accuracy_m: 8 },
  captured_at: "2026-10-10T05:55:00Z",
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function variant(sample: string, id: string, changes: Partial<SiteFeature["properties"]>): SiteFeature {
  const feature = siteFixture(sample);
  return { ...feature, properties: { ...feature.properties, site_id: id, ...changes } };
}

async function start(sites = new FakeSiteRepository()): Promise<FastifyInstance> {
  for (const sample of ["jdh-1", "jdh-2", "jdh-3"]) {
    sites.putFeature(siteFixture(sample), { reporterDevices: [DEVICE_A] });
  }
  const unvoted = variant("jpr-1", "site_jpr_1", { votes: { confirm: 0, reject: 0 }, corroborations: 0 });
  sites.putFeature(unvoted, { reporterDevices: [DEVICE_A] });
  const clock = new FixedClock();
  const reports = new FakeReportStatus();
  const routes = new SiteRoutes({
    finder: new SiteFinder(sites, new NgeohashCells()),
    votes: new VoteService({ sites, votes: new FakeVoteRepository(), devices: new FakeDevices(), reports, clock }),
    cleanups: new CleanupIntake({ sites, cleanups: new FakeCleanups(), queue: new FakeQueue(), clock }),
  });
  const settings = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(settings, [routes.plugin()], logger);
  return app;
}

describe("GET /sites?bbox", () => {
  it("returns the sites inside the box as a FeatureCollection, newest first", async () => {
    const response = await (await start()).inject({ url: `/sites?bbox=${JODHPUR}` });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ type: string; features: SiteFeature[] }>();
    expect(body.type).toBe("FeatureCollection");
    expect(body.features.map((feature) => feature.properties.site_id)).toEqual(["site_jdh_2", "site_jdh_3", "site_jdh_1"]);
    body.features.forEach((feature) => validateSite(feature));
    expect(body.features[2]).toEqual(siteFixture("jdh-1"));
  });

  it("leaves out rejected sites", async () => {
    const sites = new FakeSiteRepository();
    sites.putFeature(variant("jdh-1", "site_gone", { verification: "rejected", last_reported_at: "2026-10-10T09:00:00Z" }));
    const body = (await (await start(sites)).inject({ url: `/sites?bbox=${JODHPUR}` })).json<{ features: SiteFeature[] }>();
    expect(body.features.map((feature) => feature.properties.site_id)).not.toContain("site_gone");
  });

  it("caps the answer at the 500 newest sites", async () => {
    const sites = new FakeSiteRepository();
    for (let n = 0; n < 501; n += 1) {
      const feature = variant("jdh-2", `site_n${n}`, { last_reported_at: new Date(Date.UTC(2026, 9, 10, 9, 0, n)).toISOString() });
      sites.putFeature({ ...feature, geometry: { type: "Point", coordinates: [73.0 + n * 0.0001, 26.3] } });
    }
    const body = (await (await start(sites)).inject({ url: `/sites?bbox=${JODHPUR}` })).json<{ features: SiteFeature[] }>();
    expect(body.features).toHaveLength(500);
    expect(body.features[0]?.properties.site_id).toBe("site_n500");
    expect(body.features.map((feature) => feature.properties.site_id)).not.toContain("site_n0");
  });

  it.each([
    ["", 400, "bad_request"],
    ["?bbox=73,26,74", 400, "bad_request"],
    ["?bbox=72,26,74,27", 400, "bbox_too_large"],
  ])("GET /sites%s returns %i %s", async (query, status, error) => {
    const response = await (await start()).inject({ url: `/sites${query}` });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ error });
  });
});

describe("GET /sites/{id}", () => {
  it("returns one site", async () => {
    const response = await (await start()).inject({ url: "/sites/site_jpr_1" });
    expect(response.statusCode).toBe(200);
    expect(validateSite(response.json()).properties.site_id).toBe("site_jpr_1");
  });

  it.each(["site_nope", "SITE-1"])("returns 404 not_found for %s", async (id) => {
    const response = await (await start()).inject({ url: `/sites/${id}` });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });
});

describe("POST /sites/{id}/votes", () => {
  const post = async (payload: object, id = "site_jpr_1") =>
    (await start()).inject({ method: "POST", url: `/sites/${id}/votes`, payload });

  it("records the vote and returns the vote result", async () => {
    const response = await post(VOTE);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ site_id: "site_jpr_1", votes: { confirm: 1, reject: 0 }, verification: "community_check" });
  });

  it.each([
    ["own_site", 403, { ...VOTE, device_token: DEVICE_A }],
    ["too_far", 403, { ...VOTE, gps: { lat: 26.2618, lon: 73.0035, accuracy_m: 5 } }],
    ["bad_request", 400, { ...VOTE, vote: "maybe" }],
    ["bad_request", 400, { ...VOTE, device_token: "not-a-token" }],
  ])("returns %s", async (error, status, payload) => {
    const response = await post(payload);
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ error });
  });
});

describe("POST /sites/{id}/cleanup", () => {
  const post = (target: FastifyInstance, payload: object, id = "site_jdh_2") =>
    target.inject({ method: "POST", url: `/sites/${id}/cleanup`, payload });

  it("accepts an after-photo with 202 and the cleanup id", async () => {
    const target = await start();
    const response = await post(target, CLEANUP);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ cleanup_id: "cln_jdh_1c", site_id: "site_jdh_2", status: "checking" });
    const site = await target.inject({ url: "/sites/site_jdh_2" });
    expect(site.json<SiteFeature>().properties.cleanup_status).toBe("checking");
  });

  it("returns 409 cleanup_pending while another after-photo is checking", async () => {
    const target = await start();
    await post(target, CLEANUP);
    const response = await post(target, { ...CLEANUP, upload_id: "upl_jdh_2c" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "cleanup_pending" });
  });

  it("returns 409 already_cleaned for a cleaned site", async () => {
    const sites = new FakeSiteRepository();
    sites.putFeature(variant("jdh-2", "site_clean", { status: "cleaned", cleanup_status: "accepted" }));
    const response = await post(await start(sites), CLEANUP, "site_clean");
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "already_cleaned" });
  });

  it("returns 400 bad_request for a malformed body", async () => {
    const response = await post(await start(), { ...CLEANUP, captured_at: "today" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
  });
});
