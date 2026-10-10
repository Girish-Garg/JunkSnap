import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { validateSite } from "../../src/contracts/index.gen.js";
import { UnauthorizedError } from "../../src/domain/errors.js";
import type { SiteFeature } from "../../src/domain/sites/SiteTypes.js";
import { GuardedSiteUsers, type UserGuard } from "../../src/handlers/sites/GuardedSiteUsers.js";
import { SiteRoutes } from "../../src/handlers/sites/SiteRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import { CleanupIntake } from "../../src/services/sites/CleanupIntake.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { SiteFinder } from "../../src/services/sites/SiteFinder.js";
import { VoteService } from "../../src/services/sites/VoteService.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { Site } from "../../src/domain/sites/Site.js";
import { LogSink } from "../LogSink.js";
import { DEVICE_A, DEVICE_B, report, shown, siteFixture, userOf } from "./builders.js";
import {
  FakeCleanups,
  FakeQueue,
  FakeReportStatus,
  FakeSiteRepository,
  FakeVoteRepository,
  FixedClock,
} from "./fakes.js";
import { withdrawalRig, type WithdrawalRig } from "./withdrawalFakes.js";

const JODHPUR = "72.9,26.2,73.1,26.4";
const VOTE = { device_token: DEVICE_B, vote: "confirm", gps: { lat: 26.853, lon: 75.815, accuracy_m: 10 } };
const CLEANUP = {
  upload_id: "upl_jdh_1c",
  device_token: DEVICE_B,
  sha256: "b".repeat(64),
  gps: { lat: 26.2619, lon: 73.0035, accuracy_m: 8 },
  captured_at: "2026-10-10T05:55:00Z",
};

const SIGN_IN = "Sign in to do this.";

// Stands in for RouteGuard: "Bearer <user id>" signs in, anything else is refused.
class FakeGuard implements UserGuard {
  async requireUser(request: { headers: Record<string, unknown> }): Promise<{ userId: string }> {
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      throw new UnauthorizedError(SIGN_IN);
    }
    return { userId: header.slice("Bearer ".length) };
  }
}

const SIGNED_IN = { authorization: `Bearer ${userOf(DEVICE_B)}` };
let app: FastifyInstance | undefined;
let votes: FakeVoteRepository;
let cleanups: FakeCleanups;
let rig: WithdrawalRig;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function variant(sample: string, id: string, changes: Partial<SiteFeature["properties"]>): SiteFeature {
  const feature = siteFixture(sample);
  return { ...feature, properties: { ...feature.properties, site_id: id, ...changes } };
}

async function start(sites = new FakeSiteRepository()): Promise<FastifyInstance> {
  const reporter = { reporterDevices: [DEVICE_A], reporterUsers: [userOf(DEVICE_A)], reporterIds: [userOf(DEVICE_A)] };
  for (const sample of ["jdh-1", "jdh-2", "jdh-3"]) {
    sites.putFeature(siteFixture(sample), reporter);
  }
  const unvoted = variant("jpr-1", "site_jpr_1", { votes: { confirm: 0, reject: 0 }, corroborations: 0 });
  sites.putFeature(unvoted, reporter);
  const clock = new FixedClock();
  const retry = new ConflictRetry();
  votes = new FakeVoteRepository();
  cleanups = new FakeCleanups();
  rig = withdrawalRig(sites);
  const routes = new SiteRoutes({
    finder: new SiteFinder(sites, new NgeohashCells(), clock),
    votes: new VoteService({ sites, votes, reports: new FakeReportStatus(), clock, retry }),
    cleanups: new CleanupIntake({ sites, cleanups, queue: new FakeQueue(), clock, retry }),
    withdrawals: rig.service,
    users: new GuardedSiteUsers(new FakeGuard()),
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
    expect(body.features[2]).toEqual(shown(siteFixture("jdh-1")));
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
  const post = async (payload: object, headers: Record<string, string> = SIGNED_IN, id = "site_jpr_1") =>
    (await start()).inject({ method: "POST", url: `/sites/${id}/votes`, payload, headers });

  it("records the vote under the signed-in user, ignoring a user_id in the body", async () => {
    const response = await post({ ...VOTE, user_id: "someone-else" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      site_id: "site_jpr_1",
      votes: { confirm: 1, reject: 0, cleaned: 0 },
      backers: { count: 2, needed: 10, photo_people: 1, vote_people: 1 },
      verification: "unverified",
    });
    expect((await votes.forSite("site_jpr_1"))[0]?.userId).toBe(userOf(DEVICE_B));
  });

  it("asks for sign-in before looking at the site or the body", async () => {
    const response = await post({ vote: "maybe" }, {}, "site_nope");
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized", message: SIGN_IN });
    expect(await votes.forSite("site_nope")).toEqual([]);
  });

  it.each([
    ["own_site", 403, { ...VOTE, device_token: DEVICE_A }, SIGNED_IN],
    ["own_site", 403, VOTE, { authorization: `Bearer ${userOf(DEVICE_A)}` }],
    ["too_far", 403, { ...VOTE, gps: { lat: 26.2618, lon: 73.0035, accuracy_m: 5 } }, SIGNED_IN],
    ["bad_request", 400, { ...VOTE, vote: "maybe" }, SIGNED_IN],
    ["bad_request", 400, { ...VOTE, device_token: "not-a-token" }, SIGNED_IN],
  ])("returns %s", async (error, status, payload, headers) => {
    const response = await post(payload, headers);
    expect(response.statusCode).toBe(status);
    expect(response.json()).toMatchObject({ error });
  });
});

describe("POST /sites/{id}/cleanup", () => {
  const post = (target: FastifyInstance, payload: object, id = "site_jdh_2", headers: Record<string, string> = SIGNED_IN) =>
    target.inject({ method: "POST", url: `/sites/${id}/cleanup`, payload, headers });

  it("accepts an after-photo with 202 and stores the signed-in user", async () => {
    const target = await start();
    const response = await post(target, CLEANUP);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ cleanup_id: "cln_jdh_1c", site_id: "site_jdh_2", status: "checking" });
    expect(cleanups.records.get("cln_jdh_1c")?.user_id).toBe(userOf(DEVICE_B));
    const site = await target.inject({ url: "/sites/site_jdh_2" });
    expect(site.json<SiteFeature>().properties.cleanup_status).toBe("checking");
  });

  it("asks for sign-in first", async () => {
    const response = await post(await start(), CLEANUP, "site_jdh_2", {});
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized", message: SIGN_IN });
    expect(cleanups.records.size).toBe(0);
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

describe("DELETE /sites/{id}/reports/mine", () => {
  const withdraw = (headers: Record<string, string>) => ({ method: "DELETE" as const, url: "/sites/site_jdh_9/reports/mine", headers });
  const MINE = { ...SIGNED_IN, "x-device-token": DEVICE_B };

  async function startWithMine(): Promise<FastifyInstance> {
    const sites = new FakeSiteRepository();
    const mine = report({ id: "jdh_9", device: DEVICE_B });
    sites.put(Site.found(mine));
    const started = await start(sites);
    rig.rows.add("site_jdh_9", mine);
    return started;
  }

  it("needs a signed-in user before anything else", async () => {
    const response = await (await startWithMine()).inject(withdraw({ "x-device-token": DEVICE_B }));
    expect(response.statusCode).toBe(401);
  });

  it("needs the device token header", async () => {
    const response = await (await startWithMine()).inject(withdraw(SIGNED_IN));
    expect(response.statusCode).toBe(400);
  });

  it("answers 404 to a signed-in user who did not report the site", async () => {
    const other = { authorization: `Bearer ${userOf(DEVICE_A)}`, "x-device-token": DEVICE_A };
    const response = await (await startWithMine()).inject(withdraw(other));
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });

  it("withdraws the reporter's report and removes the site they alone backed", async () => {
    const response = await (await startWithMine()).inject(withdraw(MINE));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      site_id: "site_jdh_9",
      withdrawn_report_ids: ["rpt_jdh_9"],
      site_removed: true,
      status: "removed",
      verification: "unverified",
      backers: { count: 1, needed: 10, photo_people: 1, vote_people: 0 },
    });
    const listed = (await app?.inject({ url: `/sites?bbox=${JODHPUR}` }))?.json<{ features: SiteFeature[] }>();
    expect(listed?.features.map((feature) => feature.properties.site_id)).not.toContain("site_jdh_9");
  });
});
