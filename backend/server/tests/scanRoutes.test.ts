import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { UnauthorizedError } from "../src/domain/errors.js";
import { RouteGuard } from "../src/handlers/auth/RouteGuard.js";
import { ROUTE_BUILDERS } from "../src/handlers/routes.js";
import { buildScanRoutes, scanRoutes } from "../src/handlers/scanRoutes.js";
import { createApp } from "../src/handlers/web.js";
import type { AuthUser, Authenticator } from "../src/ports/Authenticator.js";
import { ScanIntake } from "../src/services/ScanIntake.js";
import { ScanSessionRules } from "../src/services/ScanSessionRules.js";
import { ScanUploadPresigner } from "../src/services/ScanUploadPresigner.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";
import { ScanFindings } from "../src/domain/scout/ScanFindings.js";
import { PublicMedia } from "../src/domain/sites/PublicMedia.js";
import { FakeFrameOutcomeReader, FakeScanQueue, FakeScanRepository, FakeUploadSigner, NOW, sampleSession, USER_ID } from "./scanFakes.js";

const DEVICE = "a71e5c90-2d3b-4f86-b1c4-9e0d27f58a63";
const OTHER_USER = "5b0e2c4d-7a91-4f3e-8c6d-2e1f0a9b8c7d";
const PRESIGN = { content_type: "video/webm", sha256: "a".repeat(64), size_bytes: 9_400_000, duration_ms: 8000, device_token: DEVICE };
const OWNER = "token-owner";
const OTHER = "token-other";

// Signature checks are RouteGuard's own tests; here a token is just a name for a user.
class FakeAuthenticator implements Authenticator {
  async verify(token: string): Promise<AuthUser> {
    const userId = { [OWNER]: USER_ID, [OTHER]: OTHER_USER }[token];
    if (userId === undefined) {
      throw new UnauthorizedError("Your sign-in is not valid. Please sign in again.");
    }
    return { userId };
  }
}

let app: FastifyInstance;
let scans: FakeScanRepository;
let queue: FakeScanQueue;
let signer: FakeUploadSigner;
let outcomes: FakeFrameOutcomeReader;

beforeEach(async () => {
  scans = new FakeScanRepository();
  queue = new FakeScanQueue();
  signer = new FakeUploadSigner();
  const now = (): Date => NOW;
  const presigner = new ScanUploadPresigner(signer, { ttlSeconds: 300, now, newScanId: () => "scn_01k7abc" });
  outcomes = new FakeFrameOutcomeReader();
  const findings = new ScanFindings(new PublicMedia("https://cdn.example"));
  const intake = new ScanIntake({ scans, queue, rules: new ScanSessionRules(), outcomes, findings, now });
  const guard = new RouteGuard(new FakeAuthenticator());
  const settings = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(settings, [scanRoutes({ presigner, intake, guard })], logger);
});

afterEach(async () => {
  await app.close();
});

function headers(token: string | null) {
  return token === null ? {} : { authorization: `Bearer ${token}` };
}

function post(url: string, payload: object, token: string | null = OWNER) {
  return app.inject({ method: "POST", url, payload, headers: headers(token) });
}

function get(id: string, token: string | null = OWNER) {
  return app.inject({ url: `/scans/${id}`, headers: headers(token) });
}

describe("POST /scans/presign", () => {
  it("returns a scan id and a private PUT URL for scans/{scan_id}.webm", async () => {
    const response = await post("/scans/presign", PRESIGN);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      scan_id: "scn_01k7abc",
      upload_url: "https://originals.example/scans/scn_01k7abc.webm?signed",
      headers: { "Content-Type": "video/webm" },
      expires_at: "2026-10-10T04:07:20.000Z",
    });
    expect(signer.uploads).toEqual([
      { key: "scans/scn_01k7abc.webm", contentType: "video/webm", sha256Hex: "a".repeat(64), sizeBytes: 9_400_000 },
    ]);
  });

  it("uses .mp4 for an mp4 video", async () => {
    await post("/scans/presign", { ...PRESIGN, content_type: "video/mp4" });
    expect(signer.uploads[0]?.key).toBe("scans/scn_01k7abc.mp4");
  });

  it.each([
    ["over 40 MB", "scan_too_large", { size_bytes: 40 * 1024 * 1024 + 1 }, "size_bytes is over the scan video limit"],
    ["over 60 s", "scan_too_large", { duration_ms: 60_001 }, "duration_ms is over the scan video limit"],
    ["not a video type", "bad_request", { content_type: "image/jpeg" }, "content_type"],
    ["a bad checksum", "bad_request", { sha256: "XYZ" }, "sha256"],
    ["an unknown field", "bad_request", { user_id: "someone" }, "user_id"],
  ])("rejects a video %s with 400 %s", async (_case, error, change, message) => {
    const response = await post("/scans/presign", { ...PRESIGN, ...change });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error });
    expect(response.json<{ message: string }>().message).toContain(message);
    expect(signer.uploads).toHaveLength(0);
  });
});

describe("sign-in", () => {
  it.each([
    ["POST /scans/presign", () => post("/scans/presign", PRESIGN, null)],
    ["POST /scans", () => post("/scans", sampleSession(), null)],
    ["GET /scans/{id}", () => get("scn_jpr_1", null)],
    ["a token the pool does not know", () => post("/scans", sampleSession(), "token-forged")],
  ])("%s without a valid token returns 401 and touches nothing", async (_case, send) => {
    const response = await send();
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });
    expect(signer.uploads).toHaveLength(0);
    expect(scans.rows.size).toBe(0);
    expect(queue.messages).toHaveLength(0);
  });
});

describe("POST /scans", () => {
  it("stores the session as queued with received_at and queues one kind scan message", async () => {
    const response = await post("/scans", sampleSession());
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ scan_id: "scn_jpr_1", status: "queued" });
    expect(scans.rows.get("scn_jpr_1")).toMatchObject({
      status: "queued",
      received_at: NOW.toISOString(),
      report_ids: [],
      gps_track: sampleSession().gps_track,
    });
    expect(queue.messages).toEqual([{ kind: "scan", scan_id: "scn_jpr_1" }]);
  });

  it.each([
    ["an area scout", { report_type: "auto", context: "auto" }],
    ["a picked type with an automatic place", { report_type: "overflowing_bin", context: "auto" }],
  ])("accepts %s (contracts v1.10)", async (_case, change) => {
    const response = await post("/scans", { ...sampleSession(), ...change });
    expect(response.statusCode).toBe(202);
    expect(scans.rows.get("scn_jpr_1")).toMatchObject(change);
  });

  it("takes user_id from the verified token, never from the body", async () => {
    await post("/scans", sampleSession({ user_id: "chosen-by-the-phone" }));
    expect(scans.rows.get("scn_jpr_1")?.user_id).toBe(USER_ID);
  });

  it("is idempotent per scan id and re-sends the message only while the scan is still queued", async () => {
    await post("/scans", sampleSession());
    const retried = await post("/scans", sampleSession());
    expect(retried.statusCode).toBe(202);
    expect(queue.messages).toHaveLength(2);
    await scans.update("scn_jpr_1", { status: "processing", reason: null, updated_at: NOW.toISOString() });
    const late = await post("/scans", sampleSession());
    expect(late.json()).toEqual({ scan_id: "scn_jpr_1", status: "processing" });
    expect(queue.messages).toHaveLength(2);
    expect(scans.rows.size).toBe(1);
  });

  it("refuses a scan id another user already used", async () => {
    await post("/scans", sampleSession());
    const response = await post("/scans", sampleSession(), OTHER);
    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toContain("scan_id is taken");
    expect(scans.rows.get("scn_jpr_1")?.user_id).toBe(USER_ID);
    expect(queue.messages).toHaveLength(1);
  });

  it.each([
    ["a missing gps_track", { gps_track: undefined }, "gps_track"],
    ["an empty gps_track", { gps_track: [] }, "gps_track"],
    ["a fix without accuracy", { gps_track: [{ t_ms: 0, lat: 26.85, lon: 75.81 }] }, "accuracy_m"],
    ["a context that does not fit the type", { context: "sewage" }, "context"],
    ["an area scout with a picked place", { report_type: "auto", context: "vacant_plot" }, "context"],
    ["a no-bin scan with an automatic place", { report_type: "no_bin", context: "auto" }, "context"],
    ["a video over 60 s", { duration_ms: 60_001 }, "duration_ms"],
    ["fixes out of order", { gps_track: [...sampleSession().gps_track].reverse() }, "t_ms must increase"],
    ["too few fixes", { gps_track: sampleSession().gps_track.slice(0, 3) }, "at least 8 fixes"],
    ["another scan's video", { video_key: "scans/scn_other.mp4" }, "video_key"],
  ])("rejects %s with 400 and queues nothing", async (_case, change, message) => {
    const response = await post("/scans", { ...sampleSession(), ...change });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toContain(message);
    expect(queue.messages).toHaveLength(0);
    expect(scans.rows.size).toBe(0);
  });
});

describe("GET /scans/{id}", () => {
  it("shows the owner the status, frame counts and report ids", async () => {
    await post("/scans", sampleSession());
    const frames = { sampled: 8, kept: 6, dropped_no_fix: 1 };
    await scans.update("scn_jpr_1", { status: "done", reason: null, frames, report_ids: ["rpt_a"], updated_at: "2026-10-10T04:02:52Z" });
    const response = await get("scn_jpr_1");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      scan_id: "scn_jpr_1",
      status: "done",
      reason: null,
      frames,
      report_ids: ["rpt_a"],
      found: { sites: 0, by_type: {}, checking: 0, frames: [] },
      received_at: NOW.toISOString(),
      updated_at: "2026-10-10T04:02:52Z",
    });
  });

  it("has no found summary until the worker is done cutting frames", async () => {
    await post("/scans", sampleSession());
    expect((await get("scn_jpr_1")).json()).toMatchObject({ status: "queued", found: null });
  });

  it("counts sites the passed frames landed in, by type, and shows every frame's result", async () => {
    await post("/scans", sampleSession());
    const media = (id: string) => ({ outcome: "passed", blurred_key: `media/reports/${id}.jpg` });
    const rows = [
      { report_id: "rpt_a", status: "unverified", report_type: "waste_dump", site_id: "site_1", scan: { t_ms: 0 }, moderation_result: media("rpt_a") },
      { report_id: "rpt_b", status: "unverified", report_type: "waste_dump", site_id: "site_1", scan: { t_ms: 1000 }, moderation_result: media("rpt_b") },
      { report_id: "rpt_c", status: "verified", report_type: "overflowing_bin", site_id: "site_2", scan: { t_ms: 2000 }, moderation_result: media("rpt_c") },
      { report_id: "rpt_d", status: "rejected", report_type: "waste_dump", scan: { t_ms: 3000 }, moderation_result: media("rpt_d") },
      { report_id: "rpt_e", status: "rejected", report_type: "waste_dump", scan: { t_ms: 4000 }, moderation_result: { outcome: "rejected", blurred_key: null } },
      { report_id: "rpt_f", status: "processing", report_type: "waste_dump", scan: { t_ms: 5000 } },
      { report_id: "rpt_g", status: "withdrawn", report_type: "waste_dump", site_id: "site_3", scan: { t_ms: 6000 }, moderation_result: media("rpt_g") },
    ];
    rows.forEach((row) => outcomes.rows.set(row.report_id, row));
    const ids = rows.map((row) => row.report_id);
    await scans.update("scn_jpr_1", { status: "done", reason: null, report_ids: ids, updated_at: "2026-10-10T04:02:52Z" });
    const found = (await get("scn_jpr_1")).json().found;
    expect(found).toMatchObject({ sites: 2, by_type: { waste_dump: 1, overflowing_bin: 1 }, checking: 1 });
    const results = found.frames.map((frame: { result: string }) => frame.result);
    expect(results).toEqual(["waiting", "waiting", "added", "not_waste", "skipped", "checking", "withdrawn"]);
    expect(found.frames[0]).toEqual({
      report_id: "rpt_a", t_ms: 0, result: "waiting", report_type: "waste_dump", site_id: "site_1",
      blurred_url: "https://cdn.example/media/reports/rpt_a.jpg",
    });
    expect(found.frames[4].blurred_url).toBeNull();
  });

  it.each([
    ["another signed-in user", "scn_jpr_1", OTHER],
    ["an unknown scan", "scn_nothing", OWNER],
  ])("returns 404 for %s", async (_case, id, token) => {
    await post("/scans", sampleSession());
    const response = await get(id, token);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });
});

describe("buildScanRoutes", () => {
  const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  const scanEnv = {
    JUNKSNAP_STAGE: "dev",
    ORIGINALS_BUCKET: "junksnap-dev-originals-1",
    REPORTS_QUEUE_URL: "https://sqs.ap-south-1.amazonaws.com/1/junksnap-dev-reports",
    SCANS_TABLE: "junksnap-dev-scans",
    REPORTS_TABLE: "junksnap-dev-reports",
    PUBLIC_BASE_URL: "https://d111111abcdef8.cloudfront.net",
  };
  const env = { ...scanEnv, COGNITO_USER_POOL_ID: "ap-south-1_AbCdEf123", COGNITO_CLIENT_ID: "client-1" };

  it("is registered with the api", () => {
    expect(ROUTE_BUILDERS).toContain(buildScanRoutes);
  });

  it.each([
    ["the bucket, queue and tables", { JUNKSNAP_STAGE: "dev" }, "SCANS_TABLE"],
    ["the Cognito user pool", scanEnv, "COGNITO_USER_POOL_ID"],
  ])("stops the api from starting without %s", async (_case, partial, missing) => {
    await expect(createApp(core, [buildScanRoutes({ core, env: partial })], logger)).rejects.toThrow(missing);
  });

  it("serves the scan routes behind sign-in once its environment is set, without calling AWS", async () => {
    const built = await createApp(core, [buildScanRoutes({ core, env })], logger);
    const response = await built.inject({ method: "POST", url: "/scans/presign", payload: PRESIGN });
    expect(response.statusCode).toBe(401);
    await built.close();
  });
});
