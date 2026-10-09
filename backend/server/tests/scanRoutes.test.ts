import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { ROUTE_BUILDERS } from "../src/handlers/routes.js";
import { buildScanRoutes, scanRoutes } from "../src/handlers/scanRoutes.js";
import { createApp } from "../src/handlers/web.js";
import { ScanIntake } from "../src/services/ScanIntake.js";
import { ScanSessionRules } from "../src/services/ScanSessionRules.js";
import { ScanUploadPresigner } from "../src/services/ScanUploadPresigner.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";
import { FakeScanQueue, FakeScanRepository, FakeUploadSigner, NOW, sampleSession } from "./scanFakes.js";

const DEVICE = "a71e5c90-2d3b-4f86-b1c4-9e0d27f58a63";
const OTHER_DEVICE = "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14";
const PRESIGN = { content_type: "video/webm", sha256: "a".repeat(64), size_bytes: 9_400_000, duration_ms: 8000, device_token: DEVICE };

let app: FastifyInstance;
let scans: FakeScanRepository;
let queue: FakeScanQueue;
let signer: FakeUploadSigner;

beforeEach(async () => {
  scans = new FakeScanRepository();
  queue = new FakeScanQueue();
  signer = new FakeUploadSigner();
  const now = (): Date => NOW;
  const presigner = new ScanUploadPresigner(signer, { ttlSeconds: 300, now, newScanId: () => "scn_01k7abc" });
  const intake = new ScanIntake({ scans, queue, rules: new ScanSessionRules(), now });
  const settings = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(settings, [scanRoutes({ presigner, intake })], logger);
});

afterEach(async () => {
  await app.close();
});

function post(url: string, payload: object) {
  return app.inject({ method: "POST", url, payload });
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
    ["over 40 MB", { size_bytes: 40 * 1024 * 1024 + 1 }, "size_bytes is over the scan video limit"],
    ["over 60 s", { duration_ms: 60_001 }, "duration_ms is over the scan video limit"],
    ["not a video type", { content_type: "image/jpeg" }, "content_type"],
    ["a bad checksum", { sha256: "XYZ" }, "sha256"],
    ["an unknown field", { user_id: "someone" }, "user_id"],
  ])("rejects a video %s with 400", async (_case, change, message) => {
    const response = await post("/scans/presign", { ...PRESIGN, ...change });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
    expect(response.json<{ message: string }>().message).toContain(message);
    expect(signer.uploads).toHaveLength(0);
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

  it("never trusts a user_id sent by the phone", async () => {
    await post("/scans", sampleSession());
    expect(scans.rows.get("scn_jpr_1")).not.toHaveProperty("user_id");
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

  it("refuses a scan id another device already used", async () => {
    await post("/scans", sampleSession());
    const response = await post("/scans", sampleSession({ device_token: OTHER_DEVICE }));
    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toContain("scan_id is taken");
    expect(scans.rows.get("scn_jpr_1")?.device_token).toBe(DEVICE);
  });

  it.each([
    ["a missing gps_track", { gps_track: undefined }, "gps_track"],
    ["an empty gps_track", { gps_track: [] }, "gps_track"],
    ["a fix without accuracy", { gps_track: [{ t_ms: 0, lat: 26.85, lon: 75.81 }] }, "accuracy_m"],
    ["a context that does not fit the type", { context: "sewage" }, "context"],
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
  const get = (id: string, device?: string) =>
    app.inject({ url: `/scans/${id}`, headers: device === undefined ? {} : { "x-device-token": device } });

  it("shows the owner the status, frame counts and report ids", async () => {
    await post("/scans", sampleSession());
    const frames = { sampled: 8, kept: 6, dropped_no_fix: 1 };
    await scans.update("scn_jpr_1", { status: "done", reason: null, frames, report_ids: ["rpt_a"], updated_at: "2026-10-10T04:02:52Z" });
    const response = await get("scn_jpr_1", DEVICE);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      scan_id: "scn_jpr_1",
      status: "done",
      reason: null,
      frames,
      report_ids: ["rpt_a"],
      received_at: NOW.toISOString(),
      updated_at: "2026-10-10T04:02:52Z",
    });
  });

  it.each([
    ["another device", "scn_jpr_1", OTHER_DEVICE],
    ["no device token", "scn_jpr_1", undefined],
    ["an unknown scan", "scn_nothing", DEVICE],
  ])("returns 404 for %s", async (_case, id, device) => {
    await post("/scans", sampleSession());
    const response = await get(id, device);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });
});

describe("buildScanRoutes", () => {
  const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  const env = {
    JUNKSNAP_STAGE: "dev",
    ORIGINALS_BUCKET: "junksnap-dev-originals-1",
    REPORTS_QUEUE_URL: "https://sqs.ap-south-1.amazonaws.com/1/junksnap-dev-reports",
    SCANS_TABLE: "junksnap-dev-scans",
    REPORTS_TABLE: "junksnap-dev-reports",
  };

  it("is registered with the api", () => {
    expect(ROUTE_BUILDERS).toContain(buildScanRoutes);
  });

  it("stops the api from starting without the bucket, queue and tables", async () => {
    const routes = [buildScanRoutes({ core, env: { JUNKSNAP_STAGE: "dev" } })];
    await expect(createApp(core, routes, logger)).rejects.toThrow("SCANS_TABLE");
  });

  it("serves the scan routes once its environment is set, without calling AWS for a bad body", async () => {
    const built = await createApp(core, [buildScanRoutes({ core, env })], logger);
    const response = await built.inject({ method: "POST", url: "/scans/presign", payload: {} });
    expect(response.statusCode).toBe(400);
    await built.close();
  });
});
