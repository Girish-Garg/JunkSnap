import { beforeEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { StandInNearbyCounter } from "../src/adapters/StandInNearbyCounter.js";
import { StandInStep } from "../src/adapters/StandInStep.js";
import type { VerificationResult } from "../src/contracts/index.gen.js";
import { InternalDataError, ValidationError } from "../src/domain/errors.js";
import { QueueMessage } from "../src/domain/QueueMessage.js";
import { Report } from "../src/domain/Report.js";
import type { MergeOutcome } from "../src/domain/ReportRecord.js";
import type { MessageHandler } from "../src/ports/MessageHandler.js";
import type { PipelineStep } from "../src/ports/PipelineStep.js";
import { BrandsStep } from "../src/services/BrandsStep.js";
import { LocateStep } from "../src/services/LocateStep.js";
import { MergeStep } from "../src/services/MergeStep.js";
import { MessageRouter } from "../src/services/MessageRouter.js";
import { ModerateStep } from "../src/services/ModerateStep.js";
import { ReporterReputation } from "../src/services/ReporterReputation.js";
import { ReportPipeline } from "../src/services/ReportPipeline.js";
import { VerifyStep } from "../src/services/VerifyStep.js";
import { LogSink } from "./LogSink.js";
import {
  FakeBrandReader,
  FakeLocator,
  FakeMerger,
  FakeModerator,
  FakeReportRepository,
  FakeReputationReader,
  FakeVerifier,
  FixedClock,
  Journal,
  moderation,
  upload,
  verification,
} from "./reportFakes.js";

const RECEIVED = "2026-10-10T02:14:52Z";
const ALL_STEPS = ["moderate", "verify", "brands", "locate", "merge"];
const USER = "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7";

let journal: Journal;
let reports: FakeReportRepository;
let reputations: FakeReputationReader;
let sink: LogSink;

beforeEach(() => {
  journal = new Journal();
  reports = new FakeReportRepository();
  reputations = new FakeReputationReader();
  sink = new LogSink();
  reports.put(Report.receive(upload(), RECEIVED, USER).toRecord());
});

interface Wiring {
  readonly verified?: VerificationResult;
  readonly merge?: MergeOutcome | null;
  readonly moderated?: ReturnType<typeof moderation>;
}

function wire({ verified = verification(), merge = null, moderated = moderation() }: Wiring = {}) {
  const moderator = new FakeModerator(journal, moderated);
  const verifier = new FakeVerifier(journal, verified);
  const merger = merge === null ? undefined : new FakeMerger(journal, merge);
  const steps: PipelineStep[] = [
    new ModerateStep(moderator),
    new VerifyStep(verifier, new ReporterReputation(reputations), new StandInNearbyCounter()),
    new BrandsStep(new FakeBrandReader(journal)),
    new LocateStep(new FakeLocator(journal)),
    merger === undefined ? new StandInStep("merge") : new MergeStep(merger),
  ];
  const logger = new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
  const pipeline = new ReportPipeline({ steps, reports, clock: new FixedClock("2026-10-10T02:15:10Z"), logger });
  return { pipeline, moderator, verifier, merger };
}

const delivery = (receiveCount = 1, body: Record<string, unknown> = { kind: "report", report_id: "rpt_jdh_1" }) =>
  new QueueMessage(body, receiveCount, 3);

describe("ReportPipeline", () => {
  it("runs moderate, verify, brands, locate, merge in order and follows the site's verification", async () => {
    const { pipeline, merger } = wire({ merge: { siteId: "site_jdh_1", verification: "verified" } });
    await pipeline.handle(delivery());
    expect(journal.calls).toEqual(ALL_STEPS);
    const stored = reports.stored("rpt_jdh_1");
    expect(stored).toMatchObject({ status: "verified", site_id: "site_jdh_1", completed_steps: ALL_STEPS });
    expect(stored).toMatchObject({ moderation_result: moderation(), updated_at: "2026-10-10T02:15:10Z" });
    expect(stored.brand_labels).toHaveLength(1);
    expect(stored.location?.town).toBe("Jodhpur");
    expect(merger?.merged[0]).toMatchObject({ report_id: "rpt_jdh_1", location: expect.any(Object) });
  });

  it("saves processing before the first step, then after every step", async () => {
    await wire().pipeline.handle(delivery());
    expect(reports.saved.map((record) => record.completed_steps.length)).toEqual([0, 1, 2, 3, 4, 5, 5]);
    expect(reports.saved[0]?.status).toBe("processing");
  });

  it("sends the ML service only the blurred key, the lower reputation and GPS accuracy", async () => {
    reputations.devices.set(upload().device_token, 0.74);
    reputations.users.set(USER, 0.9);
    const { pipeline, verifier, moderator } = wire();
    await pipeline.handle(delivery());
    expect(moderator.requests[0]).toMatchObject({
      reportId: "rpt_jdh_1",
      originalKey: "reports/upl_jdh_1.jpg",
      blurredKey: "media/reports/rpt_jdh_1.jpg",
      receivedAt: RECEIVED,
    });
    expect(verifier.requests).toEqual([
      {
        report_id: "rpt_jdh_1",
        purpose: "report",
        blurred_key: "media/reports/rpt_jdh_1.jpg",
        report_type: "waste_dump",
        context: "vacant_plot",
        features: { gps_accuracy_m: 6, reputation: 0.74, nearby_verified_reports: 0 },
      },
    ]);
  });

  it("uses the user's reputation when it is lower than the device's", async () => {
    reputations.users.set(USER, 0.3);
    const { pipeline, verifier } = wire();
    await pipeline.handle(delivery());
    expect(verifier.requests[0]?.features.reputation).toBe(0.3);
  });

  it.each([
    ["auto_verified", "verified"],
    ["community_check", "community_check"],
  ] as const)("maps decision %s to status %s when no merge result exists", async (decision, status) => {
    await wire({ verified: { ...verification(), decision } }).pipeline.handle(delivery());
    expect(reports.stored("rpt_jdh_1").status).toBe(status);
  });

  it("stops after a rejected verification", async () => {
    await wire({ verified: { ...verification(), decision: "rejected" } }).pipeline.handle(delivery());
    expect(journal.calls).toEqual(["moderate", "verify"]);
    expect(reports.stored("rpt_jdh_1")).toMatchObject({ status: "rejected", completed_steps: ["moderate", "verify"] });
  });

  it("stops after moderation rejects the photo", async () => {
    const rejected = { ...moderation(), outcome: "rejected" as const, reasons: ["unsafe_image" as const] };
    await wire({ moderated: rejected }).pipeline.handle(delivery());
    expect(journal.calls).toEqual(["moderate"]);
    expect(reports.stored("rpt_jdh_1").status).toBe("rejected");
  });

  it("skips completed steps when SQS retries the message", async () => {
    journal.failTimes("locate", 1);
    const { pipeline } = wire({ merge: { siteId: "site_jdh_1", verification: "community_check" } });
    await expect(pipeline.handle(delivery(1))).rejects.toThrow("locate failed");
    expect(reports.stored("rpt_jdh_1")).toMatchObject({ status: "processing", completed_steps: ["moderate", "verify", "brands"] });
    await pipeline.handle(delivery(2));
    expect(journal.calls).toEqual(["moderate", "verify", "brands", "locate", "locate", "merge"]);
    expect(reports.stored("rpt_jdh_1").status).toBe("community_check");
  });

  it("marks the report needs_review when the last receive fails, then lets the message go to the DLQ", async () => {
    journal.failTimes("brands", 3);
    const { pipeline } = wire();
    await expect(pipeline.handle(delivery(2))).rejects.toThrow("brands failed");
    expect(reports.stored("rpt_jdh_1").status).toBe("processing");
    await expect(pipeline.handle(delivery(3))).rejects.toThrow("brands failed");
    expect(reports.stored("rpt_jdh_1").status).toBe("needs_review");
    expect(sink.records().find((record) => record.message === "report needs review")).toMatchObject({
      level: "WARN",
      report_id: "rpt_jdh_1",
      receive_count: 3,
    });
  });

  it("ignores a repeat delivery of a settled report", async () => {
    const { pipeline } = wire({ merge: { siteId: "site_jdh_1", verification: "verified" } });
    await pipeline.handle(delivery());
    await pipeline.handle(delivery());
    expect(journal.calls).toEqual(ALL_STEPS);
  });

  it("rejects a message without a valid report id and one for a report that does not exist", async () => {
    const { pipeline } = wire();
    await expect(pipeline.handle(delivery(1, { kind: "report", report_id: 7 }))).rejects.toThrow(ValidationError);
    await expect(pipeline.handle(delivery(1, { kind: "report", report_id: "rpt_gone" }))).rejects.toThrow(
      InternalDataError,
    );
  });
});

describe("MessageRouter", () => {
  class Recorder implements MessageHandler {
    readonly kinds: string[] = [];

    async handle(message: QueueMessage): Promise<void> {
      this.kinds.push(message.kind);
    }
  }

  it("sends each kind to its handler", async () => {
    const report = new Recorder();
    const cleanup = new Recorder();
    const scan = new Recorder();
    const router = new MessageRouter({ report, cleanup, scan });
    for (const kind of ["report", "cleanup", "scan", "report"]) {
      await router.handle(new QueueMessage({ kind }, 1, 3));
    }
    expect([report.kinds, cleanup.kinds, scan.kinds]).toEqual([["report", "report"], ["cleanup"], ["scan"]]);
  });

  it.each([{ kind: "letter" }, {}, { kind: 5 }])("refuses a message of unknown kind %j", async (body) => {
    const router = new MessageRouter({ report: new Recorder() });
    await expect(router.handle(new QueueMessage(body, 1, 3))).rejects.toThrow(ValidationError);
  });
});
