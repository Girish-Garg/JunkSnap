import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import type { ReportUpload } from "../src/contracts/index.gen.js";
import { Report } from "../src/domain/Report.js";
import { UnauthorizedError } from "../src/domain/errors.js";
import { RouteGuard } from "../src/handlers/auth/RouteGuard.js";
import { ReportEndpoints } from "../src/handlers/ReportEndpoints.js";
import { createApp } from "../src/handlers/web.js";
import type { AuthUser, Authenticator } from "../src/ports/Authenticator.js";
import type { IdGenerator } from "../src/ports/IdGenerator.js";
import type { UploadSigner, UploadSignRequest } from "../src/ports/UploadSigner.js";
import { ReportIntake } from "../src/services/ReportIntake.js";
import { ReportStatusReader } from "../src/services/ReportStatusReader.js";
import { SnapLimit } from "../src/services/SnapLimit.js";
import { UploadPresigner } from "../src/services/UploadPresigner.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";
import {
  FakeReportQueue,
  FakeReportRepository,
  FakeSnapCounter,
  FixedClock,
  moderation,
  OTHER_DEVICE,
  upload,
} from "./reportFakes.js";

const NOW = "2026-10-10T02:14:52Z";
const PUBLIC_BASE_URL = "https://d111111abcdef8.cloudfront.net";
const SHA256 = "361477fa40d0646366e6b4a37679e846f82bfb66b3f791e64428ff5c21aca03c";
const DEVICE = upload().device_token;
const USER = "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7";
const OTHER_USER = "0d9a7c35-2b1e-4c8f-a6d4-7e3b5f1a9c20";

// What the phone sends: no user_id, which only the verified token supplies.
function phoneBody(changes: Partial<ReportUpload> = {}): ReportUpload {
  const body: ReportUpload = { ...upload(), ...changes };
  if (!("user_id" in changes)) {
    delete body.user_id;
  }
  return body;
}

class FakeSigner implements UploadSigner {
  readonly requests: UploadSignRequest[] = [];

  async sign(request: UploadSignRequest): Promise<string> {
    this.requests.push(request);
    return `https://originals.example/${request.key}?X-Amz-Signature=abc`;
  }
}

class CountingIds implements IdGenerator {
  #next = 0;

  next(): string {
    this.#next += 1;
    return `01jtest${this.#next}`;
  }
}

// Accepts any token as that user's id, except "expired"; the real RouteGuard reads the header.
class FakeAuthenticator implements Authenticator {
  async verify(token: string): Promise<AuthUser> {
    if (token === "expired") {
      throw new UnauthorizedError("token expired");
    }
    return { userId: token };
  }
}

let app: FastifyInstance;
let clock: FixedClock;
let signer: FakeSigner;
let reports: FakeReportRepository;
let counter: FakeSnapCounter;
let queue: FakeReportQueue;

beforeEach(async () => {
  clock = new FixedClock(NOW);
  signer = new FakeSigner();
  reports = new FakeReportRepository();
  counter = new FakeSnapCounter(reports);
  queue = new FakeReportQueue();
  const snapLimit = new SnapLimit(counter);
  const presigner = new UploadPresigner({ signer, ids: new CountingIds(), clock, snapLimit }, 300);
  const intake = new ReportIntake({ reports, snapLimit, queue, clock });
  const statuses = new ReportStatusReader(reports, PUBLIC_BASE_URL, clock);
  const plugin = new ReportEndpoints({ presigner, intake, statuses }, new RouteGuard(new FakeAuthenticator())).plugin();
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [plugin], logger);
});

afterEach(async () => {
  await app.close();
});

const auth = (user?: string) => (user === undefined ? {} : { authorization: `Bearer ${user}` });
const presign = (body: object, user?: string) =>
  app.inject({ method: "POST", url: "/uploads/presign", payload: body, headers: auth(user) });
const postReport = (body: object, user?: string) =>
  app.inject({ method: "POST", url: "/reports", payload: body, headers: auth(user) });
const getReport = (id: string, token?: string, user?: string) =>
  app.inject({ url: `/reports/${id}`, headers: { ...auth(user), ...(token === undefined ? {} : { "x-device-token": token }) } });

// Stores the jdh-1 report straight into the table; without an owner it is a guest report from before accounts.
function store(userId?: string): void {
  reports.put(Report.receive(phoneBody(), NOW, userId).toRecord());
}

// Stores n earlier reports received a minute ago, straight into the table.
function seed(n: number, changes: Partial<ReportUpload> = {}, userId?: string): void {
  const receivedAt = new Date(Date.parse(NOW) - 60_000).toISOString();
  for (let i = 0; i < n; i += 1) {
    const body = { ...phoneBody(changes), upload_id: `upl_seed_${changes.capture_mode ?? "snap"}_${i}` };
    reports.put(Report.receive(body, receivedAt, userId).toRecord());
  }
}

describe("POST /uploads/presign", () => {
  const body = { purpose: "report", content_type: "image/jpeg", sha256: SHA256, device_token: DEVICE };

  it("signs a PUT for the report original with the checksum header the phone must send", async () => {
    const response = await presign(body, USER);
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json).toEqual({
      upload_id: "upl_01jtest1",
      upload_url: "https://originals.example/reports/upl_01jtest1.jpg?X-Amz-Signature=abc",
      headers: { "Content-Type": "image/jpeg", "x-amz-checksum-sha256": expect.any(String) },
      expires_at: "2026-10-10T02:19:52Z",
    });
    const checksum = json.headers["x-amz-checksum-sha256"] as string;
    expect(Buffer.from(checksum, "base64").toString("hex")).toBe(SHA256);
    expect(signer.requests).toEqual([
      { key: "reports/upl_01jtest1.jpg", contentType: "image/jpeg", checksumBase64: checksum, expiresInSeconds: 300 },
    ]);
  });

  it("puts a cleanup after-photo under cleanups/ and never counts it as a snap", async () => {
    seed(20);
    expect((await presign({ ...body, purpose: "cleanup" }, USER)).statusCode).toBe(200);
    expect(signer.requests[0]?.key).toBe("cleanups/upl_01jtest1.jpg");
  });

  it("refuses a report photo with 429 once the device has 20 snaps this hour", async () => {
    seed(20);
    const response = await presign(body, USER);
    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ error: "rate_limited" });
    expect(signer.requests).toEqual([]);
  });

  it.each([undefined, "expired"])("answers 401 unauthorized without a valid sign-in (token %s)", async (token) => {
    const response = await presign(body, token);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });
    expect(signer.requests).toEqual([]);
  });

  it.each([
    ["a PNG", { content_type: "image/png" }],
    ["an uppercase digest", { sha256: SHA256.toUpperCase() }],
    ["a bad device token", { device_token: "not-a-uuid" }],
    ["an unknown purpose", { purpose: "avatar" }],
    ["an extra field", { extra: true }],
  ])("returns 400 bad_request for %s", async (_case, change) => {
    const response = await presign({ ...body, ...change }, USER);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request", message: expect.any(String) });
    expect(signer.requests).toEqual([]);
  });
});

describe("POST /reports", () => {
  it("stores the report with the server's received_at and the token's user, queues it and answers 202", async () => {
    const response = await postReport(phoneBody(), USER);
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ report_id: "rpt_jdh_1", status: "queued" });
    expect(queue.sent).toEqual(["rpt_jdh_1"]);
    expect(reports.stored("rpt_jdh_1")).toMatchObject({
      ...upload(),
      user_id: USER,
      report_id: "rpt_jdh_1",
      received_at: NOW,
      status: "queued",
      completed_steps: [],
    });
  });

  it.each([undefined, "expired"])("answers 401 unauthorized without a valid sign-in (token %s)", async (token) => {
    const response = await postReport(phoneBody(), token);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });
    expect(reports.records.size).toBe(0);
    expect(queue.sent).toEqual([]);
  });

  it("ignores a user_id in the body", async () => {
    await postReport(phoneBody({ user_id: OTHER_USER }), USER);
    expect(reports.stored("rpt_jdh_1").user_id).toBe(USER);
  });

  it("is idempotent: a retry returns the same report without counting or queuing it again", async () => {
    await postReport(phoneBody(), USER);
    const queries = counter.queries;
    clock.advance(5_000);
    const retry = await postReport(phoneBody(), USER);
    expect(retry.statusCode).toBe(202);
    expect(retry.json()).toEqual({ report_id: "rpt_jdh_1", status: "queued" });
    expect(queue.sent).toEqual(["rpt_jdh_1"]);
    expect(counter.queries).toBe(queries);
    expect(reports.stored("rpt_jdh_1").received_at).toBe(NOW);
  });

  it("re-queues a retried report still queued after the 5 minute visibility timeout", async () => {
    await postReport(phoneBody(), USER);
    clock.advance(299_000);
    await postReport(phoneBody(), USER);
    expect(queue.sent).toEqual(["rpt_jdh_1"]);
    clock.advance(1_000);
    await postReport(phoneBody(), USER);
    expect(queue.sent).toEqual(["rpt_jdh_1", "rpt_jdh_1"]);
  });

  it("answers queued without re-queuing once the worker has picked the report up", async () => {
    await postReport(phoneBody(), USER);
    reports.put({ ...reports.stored("rpt_jdh_1"), status: "processing" });
    const retry = await postReport(phoneBody(), USER);
    expect(retry.json()).toEqual({ report_id: "rpt_jdh_1", status: "queued" });
    expect(queue.sent).toEqual(["rpt_jdh_1"]);
  });

  it("refuses an upload id already reported by another user", async () => {
    await postReport(phoneBody(), USER);
    const response = await postReport(phoneBody(), OTHER_USER);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
  });

  it.each([
    ["a missing gps", { gps: undefined }],
    ["a context that does not fit the type", { context: "sewage" }],
    ["a bad captured_at", { captured_at: "yesterday" }],
    ["a cleanup upload id", { upload_id: "cln_jdh_1" }],
    ["a scan link on a snap", { scan: { scan_id: "scn_x", t_ms: 0 } }],
  ])("returns 400 bad_request for %s", async (_case, change) => {
    const response = await postReport({ ...phoneBody(), ...change }, USER);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request", message: expect.stringContaining("report_upload") });
    expect(queue.sent).toEqual([]);
  });

  it("refuses a scan frame, which only the worker makes", async () => {
    const frame = phoneBody({ capture_mode: "scan", scan: { scan_id: "scn_x", t_ms: 4000 } });
    const response = await postReport(frame, USER);
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("snap photos only");
  });
});

describe("Snap limit per user and per device", () => {
  const snap = (n: number, device = DEVICE) => phoneBody({ upload_id: `upl_snap_${n}`, device_token: device });

  it("allows 20 snaps an hour, refuses the 21st with 429, then allows again an hour later", async () => {
    for (let n = 1; n <= 20; n += 1) {
      expect((await postReport(snap(n), USER)).statusCode).toBe(202);
    }
    const limited = await postReport(snap(21), USER);
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({ error: "rate_limited", message: expect.stringContaining("20 photos per hour") });
    expect(reports.records.has("rpt_snap_21")).toBe(false);
    clock.advance(3_600_000);
    expect((await postReport(snap(21), USER)).statusCode).toBe(202);
  });

  it("counts a user across devices: the stricter count applies", async () => {
    seed(20, {}, USER);
    const fromOtherPhone = await postReport(snap(1, OTHER_DEVICE), USER);
    expect(fromOtherPhone.statusCode).toBe(429);
    expect((await postReport(snap(2, OTHER_DEVICE), OTHER_USER)).statusCode).toBe(202);
  });

  it("counts a device across users: the stricter count applies", async () => {
    seed(20);
    expect((await postReport(snap(1), OTHER_USER)).statusCode).toBe(429);
  });

  it("never counts scan frames toward the Snap limit", async () => {
    seed(30, { capture_mode: "scan", scan: { scan_id: "scn_x", t_ms: 0 } }, USER);
    expect((await postReport(snap(1), USER)).statusCode).toBe(202);
  });
});

describe("GET /reports/{id}", () => {
  it("returns the composite status to the signed-in owner", async () => {
    await postReport(phoneBody(), USER);
    const response = await getReport("rpt_jdh_1", undefined, USER);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      report_id: "rpt_jdh_1",
      status: "queued",
      site_id: null,
      blurred_url: null,
      report: upload(),
      moderation: null,
      verification: null,
      confirmation: null,
      received_at: NOW,
      updated_at: NOW,
    });
  });

  it("opens a guest report made before accounts with its device token", async () => {
    store();
    expect((await getReport("rpt_jdh_1", DEVICE)).statusCode).toBe(200);
  });

  it("shows the blurred copy once moderation passed", async () => {
    await postReport(phoneBody(), USER);
    reports.put({ ...reports.stored("rpt_jdh_1"), moderation_result: moderation(), status: "processing" });
    const json = (await getReport("rpt_jdh_1", undefined, USER)).json();
    expect(json.blurred_url).toBe(`${PUBLIC_BASE_URL}/media/reports/rpt_jdh_1.jpg`);
    expect(json.moderation).toEqual(moderation());
  });

  it.each([
    ["another user", { owner: USER, id: "rpt_jdh_1", viewer: OTHER_USER }],
    ["the owner's device without the owner's sign-in", { owner: USER, id: "rpt_jdh_1", token: DEVICE }],
    ["a guest report and no device token", { id: "rpt_jdh_1" }],
    ["a guest report and another device", { id: "rpt_jdh_1", token: OTHER_DEVICE }],
    ["a malformed id", { id: "upl_jdh_1", token: DEVICE }],
    ["an unknown id", { id: "rpt_nope", token: DEVICE }],
  ])("answers 404 not_found for %s", async (_case, { owner, id, token, viewer }: Record<string, string | undefined>) => {
    store(owner);
    const response = await getReport(id ?? "", token, viewer);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "not_found", message: "No report with that id for you" });
  });
});
