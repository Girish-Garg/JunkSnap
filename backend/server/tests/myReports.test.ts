import type { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DynamoUserReportLister } from "../src/adapters/DynamoUserReportLister.js";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { validateReportList, type ReportUpload } from "../src/contracts/index.gen.js";
import { ExternalServiceError, ValidationError } from "../src/domain/errors.js";
import { Report } from "../src/domain/Report.js";
import { RouteGuard } from "../src/handlers/auth/RouteGuard.js";
import { ReportEndpoints } from "../src/handlers/ReportEndpoints.js";
import { createApp } from "../src/handlers/web.js";
import type { AuthUser, Authenticator } from "../src/ports/Authenticator.js";
import { ReportIntake } from "../src/services/ReportIntake.js";
import { ReportStatusReader } from "../src/services/ReportStatusReader.js";
import { SnapLimit } from "../src/services/SnapLimit.js";
import { UploadPresigner } from "../src/services/UploadPresigner.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";
import { fakeMine } from "./myReportsFakes.js";
import { FakeReportQueue, FakeReportRepository, FakeSnapCounter, FixedClock, upload } from "./reportFakes.js";

const NOW = "2026-10-10T02:14:52Z";
const BASE = "https://cdn.example";
const USER = "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7";
const OTHER_USER = "0d9a7c35-2b1e-4c8f-a6d4-7e3b5f1a9c20";

class TokenIsUser implements Authenticator {
  async verify(token: string): Promise<AuthUser> {
    return { userId: token };
  }
}

let app: FastifyInstance;
let reports: FakeReportRepository;

beforeEach(async () => {
  const clock = new FixedClock(NOW);
  reports = new FakeReportRepository();
  const snapLimit = new SnapLimit(new FakeSnapCounter(reports));
  const presigner = new UploadPresigner({ signer: { sign: async () => "" }, ids: { next: () => "x" }, clock, snapLimit }, 300);
  const intake = new ReportIntake({ reports, snapLimit, queue: new FakeReportQueue(), clock });
  const services = { presigner, intake, statuses: new ReportStatusReader(reports, BASE, clock), mine: fakeMine(reports, BASE, clock) };
  const plugin = new ReportEndpoints(services, new RouteGuard(new TokenIsUser())).plugin();
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [plugin], logger);
});

afterEach(async () => {
  await app.close();
});

// One stored report per call, received a minute apart so the newest-first order is clear.
function store(i: number, userId: string | undefined, changes: Partial<ReportUpload> = {}): void {
  const body = { ...upload(), ...changes, upload_id: `upl_mine_${i}` };
  delete body.user_id;
  reports.put(Report.receive(body, new Date(Date.parse(NOW) + i * 60_000).toISOString(), userId).toRecord());
}

const mine = (user?: string, query = "") =>
  app.inject({ url: `/me/reports${query}`, headers: user === undefined ? {} : { authorization: `Bearer ${user}` } });

describe("GET /me/reports", () => {
  it("lists only the signed-in user's own snaps, newest first, as GET /reports/{id} shows them", async () => {
    store(1, USER);
    store(2, OTHER_USER);
    store(3, USER, { capture_mode: "scan", scan: { scan_id: "scn_x", t_ms: 0 } });
    store(4, undefined);
    store(5, USER);
    const response = await mine(USER);
    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.reports.map((each: { report_id: string }) => each.report_id)).toEqual(["rpt_mine_5", "rpt_mine_1"]);
    expect(json.reports[0]).toMatchObject({ status: "queued", site_id: null, blurred_url: null, moderation: null });
    expect(json.next_cursor).toBeNull();
    expect(() => validateReportList(json)).not.toThrow();
  });

  it("pages with next_cursor", async () => {
    [1, 2, 3].forEach((i) => store(i, USER));
    const first = (await mine(USER, "?limit=2")).json();
    expect(first.reports).toHaveLength(2);
    const second = (await mine(USER, `?limit=2&cursor=${first.next_cursor}`)).json();
    expect(second.reports.map((each: { report_id: string }) => each.report_id)).toEqual(["rpt_mine_1"]);
    expect(second.next_cursor).toBeNull();
  });

  it("needs a signed-in user", async () => {
    expect((await mine()).statusCode).toBe(401);
  });

  it.each(["?limit=0", "?limit=51", "?cursor=not%20a%20cursor", "?other=1"])("answers 400 for %s", async (query) => {
    expect((await mine(USER, query)).statusCode).toBe(400);
  });
});

// Replays scripted query results and records the commands.
class ScriptedClient {
  readonly commands: QueryCommand[] = [];

  constructor(readonly results: (object | Error)[]) {}

  async send(command: QueryCommand): Promise<object> {
    this.commands.push(command);
    const next = this.results.shift() ?? {};
    return next instanceof Error ? Promise.reject(next) : next;
  }

  documents(): DynamoDBDocumentClient {
    return this as unknown as DynamoDBDocumentClient;
  }
}

const quiet = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
const row = (userId: string) => Report.receive({ ...upload(), upload_id: "upl_row_1" }, NOW, userId).toRecord();
const cursorOf = (key: object) => Buffer.from(JSON.stringify(key)).toString("base64url");

describe("DynamoUserReportLister", () => {
  it("queries by-user newest first, snaps only, and returns the next key as a cursor", async () => {
    const last = { report_id: "rpt_row_1", user_id: USER, received_at: NOW };
    const client = new ScriptedClient([{ Items: [row(USER)], LastEvaluatedKey: last }]);
    const page = await new DynamoUserReportLister(client.documents(), "reports", quiet).page(USER, { limit: 20, cursor: null });
    expect(page.reports.map((report) => report.id)).toEqual(["rpt_row_1"]);
    expect(page.nextCursor).toBe(cursorOf(last));
    expect(client.commands[0]?.input).toMatchObject({
      TableName: "reports",
      IndexName: "by-user",
      KeyConditionExpression: "user_id = :user",
      FilterExpression: "capture_mode = :snap",
      ExpressionAttributeValues: { ":user": USER, ":snap": "snap" },
      ScanIndexForward: false,
      Limit: 20,
    });
  });

  it("starts after the cursor's key", async () => {
    const key = { report_id: "rpt_row_1", user_id: USER, received_at: NOW };
    const client = new ScriptedClient([{ Items: [] }]);
    const page = await new DynamoUserReportLister(client.documents(), "reports", quiet).page(USER, { limit: 5, cursor: cursorOf(key) });
    expect(page.nextCursor).toBeNull();
    expect(client.commands[0]?.input.ExclusiveStartKey).toEqual(key);
  });

  it.each([
    ["another user's key", cursorOf({ report_id: "rpt_row_1", user_id: OTHER_USER, received_at: NOW })],
    ["extra key fields", cursorOf({ report_id: "rpt_row_1", user_id: USER, received_at: NOW, site_id: "x" })],
    ["not json", Buffer.from("nope").toString("base64url")],
  ])("refuses a cursor with %s", async (_case, cursor) => {
    const lister = new DynamoUserReportLister(new ScriptedClient([]).documents(), "reports", quiet);
    await expect(lister.page(USER, { limit: 5, cursor })).rejects.toThrow(ValidationError);
  });

  it("skips with a warning a row that names another user or is malformed, and keeps the rest", async () => {
    const sink = new LogSink();
    const logger = new JsonLoggerFactory(sink).create({ service: "api", stage: "dev" });
    const items = [row(OTHER_USER), { report_id: "rpt_broken", user_id: USER }, row(USER)];
    const lister = new DynamoUserReportLister(new ScriptedClient([{ Items: items }]).documents(), "reports", logger);
    const page = await lister.page(USER, { limit: 5, cursor: null });
    expect(page.reports.map((report) => report.id)).toEqual(["rpt_row_1"]);
    const warnings = sink.records().filter((record) => record.message === "skipped a listed report");
    expect(warnings.map((record) => record.reason)).toEqual(["another user's row", "malformed row"]);
  });

  it("turns DynamoDB errors into ExternalServiceError", async () => {
    const lister = new DynamoUserReportLister(new ScriptedClient([new Error("throttled")]).documents(), "reports", quiet);
    await expect(lister.page(USER, { limit: 5, cursor: null })).rejects.toThrow(ExternalServiceError);
  });
});
