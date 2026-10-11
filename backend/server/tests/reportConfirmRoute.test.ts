import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { validateReportList, type ReportUpload, type VerificationResult } from "../src/contracts/index.gen.js";
import { UnauthorizedError } from "../src/domain/errors.js";
import { Report } from "../src/domain/Report.js";
import { RouteGuard } from "../src/handlers/auth/RouteGuard.js";
import { FakeUserStanding } from "./auth/FakeUserStanding.js";
import { ReportConfirmEndpoint } from "../src/handlers/ReportConfirmEndpoint.js";
import { ReportEndpoints } from "../src/handlers/ReportEndpoints.js";
import { createApp } from "../src/handlers/web.js";
import type { AuthUser, Authenticator } from "../src/ports/Authenticator.js";
import { LetterRateLimiter } from "../src/services/letters/LetterRateLimiter.js";
import { ReportConfirmer } from "../src/services/ReportConfirmer.js";
import { ReportIntake } from "../src/services/ReportIntake.js";
import { ReportStatusReader } from "../src/services/ReportStatusReader.js";
import { SnapLimit } from "../src/services/SnapLimit.js";
import { UploadPresigner } from "../src/services/UploadPresigner.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { memoryCounters, RecordingLogger } from "./letters/support.js";
import { LogSink } from "./LogSink.js";
import { fakeMine } from "./myReportsFakes.js";
import { FakeReportQueue, FakeReportRepository, FakeSnapCounter, fixture, FixedClock, moderation, OTHER_DEVICE, upload } from "./reportFakes.js";
import { QUEUE, RETRY, RULES } from "./defaults.js";

const RECEIVED = "2026-10-11T09:39:50Z";
const ASKED = "2026-10-11T09:40:14Z";
const EXPIRES = "2026-10-12T09:40:14Z";
const NOW = "2026-10-11T10:00:00Z";
const BASE_URL = "https://cdn.example";
const DEVICE = upload().device_token;
const USER = "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7";
const OTHER_USER = "0d9a7c35-2b1e-4c8f-a6d4-7e3b5f1a9c20";

class AnyUser implements Authenticator {
  async verify(token: string): Promise<AuthUser> {
    if (token === "expired") {
      throw new UnauthorizedError("token expired");
    }
    return { userId: token };
  }
}

let app: FastifyInstance;
let clock: FixedClock;
let reports: FakeReportRepository;
let queue: FakeReportQueue;
let counters: ReturnType<typeof memoryCounters>;

beforeEach(async () => {
  clock = new FixedClock(NOW);
  reports = new FakeReportRepository();
  queue = new FakeReportQueue();
  counters = memoryCounters();
  const guard = new RouteGuard(new AnyUser(), new FakeUserStanding());
  const snapLimit = new SnapLimit(new FakeSnapCounter(reports), 20);
  const presigner = new UploadPresigner({ signer: { sign: async () => "" }, ids: { next: () => "x" }, clock, snapLimit }, 300);
  const intake = new ReportIntake({ reports, snapLimit, queue, clock }, { targetMaxM: RULES.targetMaxM, requeueAfterMs: QUEUE.visibilityMs });
  const statuses = new ReportStatusReader(reports, BASE_URL, clock);
  const limiter = new LetterRateLimiter(counters, new RecordingLogger(), 20, "confirmations");
  const confirmer = new ReportConfirmer({ reports, queue, limiter, clock, publicBaseUrl: BASE_URL, saveAttempts: RETRY.saveAttempts });
  const mine = fakeMine(reports, BASE_URL, clock);
  const plugins = [new ReportEndpoints({ presigner, intake, statuses, mine }, guard).plugin(), new ReportConfirmEndpoint(confirmer, guard).plugin()];
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), plugins, logger);
  storeAsked();
});

afterEach(async () => {
  await app.close();
});

// The jdh-1 photo after the verify step asked its reporter, as the worker leaves it.
function storeAsked(): void {
  const body: ReportUpload = { ...upload() };
  const report = Report.receive(body, RECEIVED, USER);
  report.start(RECEIVED);
  report.recordModeration(moderation());
  report.completeStep("moderate", RECEIVED);
  const unsure = { ...fixture<VerificationResult>("verification_result.jdh-confirm"), report_id: "rpt_jdh_1" };
  report.recordVerification(unsure, { askedAt: ASKED, expiresAt: EXPIRES });
  report.completeStep("verify", ASKED);
  reports.put({ ...report.toRecord(), version: 3 });
}

// token null sends no X-Device-Token.
const headers = (user?: string, token: string | null = DEVICE) => ({
  ...(user === undefined ? {} : { authorization: `Bearer ${user}` }),
  ...(token === null ? {} : { "x-device-token": token }),
});
const confirm = (payload: unknown, user: string | undefined = USER, token?: string, id = "rpt_jdh_1") =>
  app.inject({ method: "POST", url: `/reports/${id}/confirm`, payload: payload as object, headers: headers(user, token ?? DEVICE) });
const read = () => app.inject({ url: "/reports/rpt_jdh_1", headers: headers(USER) });

describe("POST /reports/{id}/confirm", () => {
  it("records sure, moves the report back to processing, keeps the evidence and queues it again", async () => {
    const response = await confirm({ sure: true });
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json).toMatchObject({ report_id: "rpt_jdh_1", status: "processing", site_id: null, updated_at: NOW });
    expect(json.confirmation).toMatchObject({ answer: "sure", answered_at: NOW, asked_at: ASKED, expires_at: EXPIRES });
    expect(json.verification).toMatchObject({ decision: "needs_confirmation" });
    expect(queue.sent).toEqual(["rpt_jdh_1"]);
    const stored = reports.stored("rpt_jdh_1");
    expect(stored).toMatchObject({ status: "processing", completed_steps: ["moderate", "verify"], version: 4 });
    expect(stored.moderation_result).toEqual(moderation());
  });

  it("records not sure as a withdrawal and queues nothing", async () => {
    const response = await confirm({ sure: false });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "withdrawn", confirmation: { answer: "withdrawn", answered_at: NOW } });
    expect(reports.stored("rpt_jdh_1")).toMatchObject({ status: "withdrawn", withdrawn_at: NOW });
    expect(queue.sent).toEqual([]);
  });

  it("closes the question 24 h after it was asked: 409 confirmation_closed and status not_confirmed", async () => {
    clock.advance(Date.parse(EXPIRES) - Date.parse(NOW));
    const response = await confirm({ sure: true });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "confirmation_closed" });
    expect(reports.stored("rpt_jdh_1")).toMatchObject({ status: "not_confirmed", confirmation: { answer: "expired", answered_at: EXPIRES } });
    expect(queue.sent).toEqual([]);
  });

  it("answers a retry with the same answer 200, re-sending sure while the report is still processing", async () => {
    await confirm({ sure: true });
    const retry = await confirm({ sure: true });
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toMatchObject({ status: "processing", confirmation: { answer: "sure", answered_at: NOW } });
    expect(queue.sent).toEqual(["rpt_jdh_1", "rpt_jdh_1"]);
    expect(reports.stored("rpt_jdh_1").version).toBe(4);
  });

  it("answers a retried withdrawal 200 without another write", async () => {
    await confirm({ sure: false });
    expect((await confirm({ sure: false })).statusCode).toBe(200);
    expect(reports.saved).toHaveLength(1);
  });

  it.each([
    [true, false],
    [false, true],
  ])("refuses another answer after %s with 409 confirmation_closed", async (first, second) => {
    await confirm({ sure: first });
    const response = await confirm({ sure: second });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "confirmation_closed" });
  });

  it("refuses a report the verify step never asked about", async () => {
    reports.put({ ...reports.stored("rpt_jdh_1"), status: "unverified", confirmation: undefined });
    expect((await confirm({ sure: true })).json()).toMatchObject({ error: "confirmation_closed" });
  });

  it.each([
    ["another user", OTHER_USER, "rpt_jdh_1"],
    ["a malformed id", USER, "upl_jdh_1"],
    ["an unknown id", USER, "rpt_nope"],
  ])("answers 404 not_found for %s", async (_case, user, id) => {
    const response = await confirm({ sure: true }, user, DEVICE, id);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
    expect(reports.stored("rpt_jdh_1").status).toBe("needs_confirmation");
  });

  it.each([undefined, "expired"])("answers 401 unauthorized without a valid sign-in (token %s)", async (user) => {
    const response = await app.inject({ method: "POST", url: "/reports/rpt_jdh_1/confirm", payload: { sure: true }, headers: headers(user) });
    expect(response.statusCode).toBe(401);
    expect(counters.users.taken).toEqual([]);
  });

  it.each([
    ["an empty body", {}],
    ["a string", { sure: "yes" }],
    ["an extra field", { sure: true, user_id: OTHER_USER }],
    ["a number", { sure: 1 }],
  ])("answers 400 bad_request for %s", async (_case, body) => {
    const response = await confirm(body);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
    expect(reports.stored("rpt_jdh_1").status).toBe("needs_confirmation");
  });

  it.each([
    ["a missing device token", null],
    ["a malformed device token", "not-a-uuid"],
  ])("answers 400 bad_request for %s", async (_case, token) => {
    const response = await app.inject({ method: "POST", url: "/reports/rpt_jdh_1/confirm", payload: { sure: true }, headers: headers(USER, token) });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request", message: expect.stringContaining("X-Device-Token") });
  });

  it("allows 20 confirmations an hour per user and refuses the 21st with 429 before reading the report", async () => {
    for (let n = 0; n < 20; n += 1) {
      expect((await confirm({ sure: true }, USER, DEVICE, "rpt_nope")).statusCode).toBe(404);
    }
    const limited = await confirm({ sure: true });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: "rate_limited" });
    expect(reports.stored("rpt_jdh_1").status).toBe("needs_confirmation");
    clock.advance(3_600_000);
    expect((await confirm({ sure: false }, USER, OTHER_DEVICE)).statusCode).toBe(200);
  });

  it("counts per device too", async () => {
    for (let n = 0; n < 20; n += 1) {
      await confirm({ sure: true }, OTHER_USER, DEVICE, "rpt_nope");
    }
    expect((await confirm({ sure: true })).statusCode).toBe(429);
  });
});

describe("GET /reports/{id} with a confirmation", () => {
  it("shows the question while the reporter can still answer", async () => {
    const json = (await read()).json();
    expect(json).toMatchObject({ status: "needs_confirmation", site_id: null });
    expect(json.confirmation).toEqual({
      question: "Our check wasn't sure this shows a waste dump. Only report it if you're 100% sure.",
      reasoning: "A roadside with a few scattered items; it is hard to tell whether they are waste.",
      report_type: "waste_dump",
      asked_at: ASKED,
      expires_at: EXPIRES,
      answer: null,
      answered_at: null,
    });
  });

  it("reads as not_confirmed once the window passed, and writes that state", async () => {
    clock.advance(Date.parse(EXPIRES) - Date.parse(NOW) + 1_000);
    const json = (await read()).json();
    expect(json).toMatchObject({ status: "not_confirmed", confirmation: { answer: "expired", answered_at: EXPIRES } });
    expect(reports.stored("rpt_jdh_1").status).toBe("not_confirmed");
    expect((await confirm({ sure: true })).json()).toMatchObject({ error: "confirmation_closed" });
  });
});

describe("GET /me/reports with a confirmation (contracts v1.16)", () => {
  const mine = () => app.inject({ url: "/me/reports", headers: headers(USER) });

  it("lists a waiting report with its question, valid against report_list", async () => {
    const body = (await mine()).json();
    expect(() => validateReportList(body)).not.toThrow();
    expect(body.reports[0]).toMatchObject({ status: "needs_confirmation", confirmation: { answer: null, expires_at: EXPIRES } });
  });

  it("lists a report past its window as not_confirmed", async () => {
    clock.advance(Date.parse(EXPIRES) - Date.parse(NOW) + 1_000);
    const body = (await mine()).json();
    expect(() => validateReportList(body)).not.toThrow();
    expect(body.reports[0]).toMatchObject({ status: "not_confirmed", confirmation: { answer: "expired" } });
  });

  it("lists a confirmed report as processing with the reporter's sure answer", async () => {
    await confirm({ sure: true });
    const body = (await mine()).json();
    expect(body.reports[0]).toMatchObject({ status: "processing", confirmation: { answer: "sure" } });
  });
});
