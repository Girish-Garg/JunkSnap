import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { validateReportUpload, type ReportUpload } from "../src/contracts/index.gen.js";
import { ValidationError } from "../src/domain/errors.js";
import { Report } from "../src/domain/Report.js";
import { ReportPlacement, TARGET_MAX_M } from "../src/domain/ReportPlacement.js";
import { TargetTooFarError } from "../src/domain/TargetTooFarError.js";
import { RouteGuard } from "../src/handlers/auth/RouteGuard.js";
import { FakeUserStanding } from "./auth/FakeUserStanding.js";
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
import { FakeReportQueue, FakeReportRepository, FakeSnapCounter, FixedClock, fixture } from "./reportFakes.js";

const NOW = "2026-10-11T03:40:30Z";
const USER = "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7";
const METRES_PER_DEGREE_LAT = 111_195;

// The long-range sample: the waste about 123 m from where the reporter stood.
const far = (): ReportUpload => {
  const body = fixture<ReportUpload>("report_upload.jdh-far");
  delete body.user_id;
  return body;
};

// The fixture's reporter fix with a target the given metres due north.
function northBy(metres: number): ReportUpload {
  const body = far();
  return { ...body, target: { lat: body.gps.lat + metres / METRES_PER_DEGREE_LAT, lon: body.gps.lon } };
}

describe("report_upload target (contract)", () => {
  it("accepts the long-range sample with both points", () => {
    expect(validateReportUpload(far()).target).toEqual({ lat: 26.29147, lon: 73.0313 });
  });

  it("forbids a target on a no_bin report, whose zone is where the reporter stands", () => {
    const noBin = { ...fixture<ReportUpload>("report_upload.jdh-2"), target: { lat: 26.305, lon: 73.036 } };
    expect(() => validateReportUpload(noBin)).toThrow(ValidationError);
  });

  it("forbids a target on a scan frame and a target without both coordinates", () => {
    const scan = { ...fixture<ReportUpload>("report_upload.jpr-1"), target: { lat: 26.85, lon: 75.81 } };
    expect(() => validateReportUpload(scan)).toThrow(ValidationError);
    expect(() => validateReportUpload({ ...far(), target: { lat: 26.29 } })).toThrow(ValidationError);
  });
});

describe("ReportPlacement", () => {
  it("is the reporter's fix when there is no target", () => {
    const placement = ReportPlacement.of(fixture<ReportUpload>("report_upload.jdh-1"));
    expect(placement.longRange).toBe(false);
    expect(placement.spot).toEqual(placement.reporter);
    expect(placement.evidence()).toEqual({});
  });

  it("measures the target from the fix and keeps the distance as evidence", () => {
    const placement = ReportPlacement.of(far());
    expect(placement.spot).toMatchObject({ lat: 26.29147, lon: 73.0313 });
    expect(placement.distanceM()).toBe(123);
    expect(placement.evidence()).toEqual({ target_distance_m: 123 });
  });

  it("allows exactly the cap and refuses anything past it", () => {
    expect(() => ReportPlacement.of(northBy(TARGET_MAX_M)).assertWithinCap()).not.toThrow();
    expect(() => ReportPlacement.of(northBy(TARGET_MAX_M + 2)).assertWithinCap()).toThrow(TargetTooFarError);
  });
});

class AnyUser implements Authenticator {
  async verify(token: string): Promise<AuthUser> {
    return { userId: token };
  }
}

describe("POST /reports with a long-range target", () => {
  let app: FastifyInstance;
  let reports: FakeReportRepository;
  let queue: FakeReportQueue;

  beforeEach(async () => {
    const clock = new FixedClock(NOW);
    reports = new FakeReportRepository();
    queue = new FakeReportQueue();
    const snapLimit = new SnapLimit(new FakeSnapCounter(reports));
    const presigner = new UploadPresigner({ signer: { sign: async () => "" }, ids: { next: () => "x" }, clock, snapLimit }, 300);
    const intake = new ReportIntake({ reports, snapLimit, queue, clock });
    const statuses = new ReportStatusReader(reports, "https://cdn.example", clock);
    const mine = fakeMine(reports, "https://cdn.example", clock);
    const plugin = new ReportEndpoints({ presigner, intake, statuses, mine }, new RouteGuard(new AnyUser(), new FakeUserStanding())).plugin();
    const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
    app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [plugin], logger);
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: object) =>
    app.inject({ method: "POST", url: "/reports", payload: body, headers: { authorization: `Bearer ${USER}` } });

  it("stores both points and the distance, and queues the report", async () => {
    const response = await post(far());
    expect(response.statusCode).toBe(202);
    const stored = reports.records.get("rpt_jdh_far");
    expect(stored).toMatchObject({ gps: far().gps, target: far().target, target_distance_m: 123 });
    expect(queue.sent).toEqual(["rpt_jdh_far"]);
  });

  it("rejects a target past the cap with 422 target_too_far, before storing anything", async () => {
    const response = await post(northBy(TARGET_MAX_M + 100));
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({ error: "target_too_far", message: expect.stringContaining("within 500 m") });
    expect(reports.records.size).toBe(0);
    expect(queue.sent).toEqual([]);
  });

  it("returns both points to the reporter who owns the report", async () => {
    await post(far());
    const response = await app.inject({ url: "/reports/rpt_jdh_far", headers: { authorization: `Bearer ${USER}` } });
    expect(response.json().report).toMatchObject({ gps: far().gps, target: far().target });
  });

  it("keeps a plain report without a target or a distance", () => {
    const record = Report.receive(fixture<ReportUpload>("report_upload.jdh-1"), NOW, USER).toRecord();
    expect(record.target).toBeUndefined();
    expect(record.target_distance_m).toBeUndefined();
  });
});
