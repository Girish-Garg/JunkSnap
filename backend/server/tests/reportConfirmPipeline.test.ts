import { beforeEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { NgeohashCells } from "../src/adapters/sites/NgeohashCells.js";
import type { VerificationResult } from "../src/contracts/index.gen.js";
import { InternalDataError } from "../src/domain/errors.js";
import { QueueMessage } from "../src/domain/QueueMessage.js";
import { Report } from "../src/domain/Report.js";
import type { ReportMerger } from "../src/ports/ReportMerger.js";
import { ScanFindings } from "../src/domain/scout/ScanFindings.js";
import { MergeableReportFactory } from "../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../src/domain/sites/PublicMedia.js";
import type { PipelineStep } from "../src/ports/PipelineStep.js";
import { BinLocator } from "../src/services/BinLocator.js";
import { BrandsStep } from "../src/services/BrandsStep.js";
import { LocateStep } from "../src/services/LocateStep.js";
import { MergeStep } from "../src/services/MergeStep.js";
import { ModerateStep } from "../src/services/ModerateStep.js";
import { NearPlacesFinder } from "../src/services/NearPlacesFinder.js";
import { ReporterReputation } from "../src/services/ReporterReputation.js";
import { ReportPipeline } from "../src/services/ReportPipeline.js";
import { ConflictRetry } from "../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../src/services/sites/MergeTargetPicker.js";
import { SiteMerger } from "../src/services/sites/SiteMerger.js";
import { VerifyStep } from "../src/services/VerifyStep.js";
import { SiteReportMerger } from "../src/services/wiring/SiteReportMerger.js";
import { ReportWorkerSettings } from "../src/settings/ReportWorkerSettings.js";
import { LogSink } from "./LogSink.js";
import {
  confirmWindow,
  FakeBrandReader,
  FakeLocator,
  FakeModerator,
  FakeNearbyCounter,
  FakeReportRepository,
  FakeReputationReader,
  FakeVerifier,
  fixture,
  FixedClock,
  Journal,
  SkippedStep,
  upload,
} from "./reportFakes.js";
import { evidence } from "./sites/builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock as SiteClock } from "./sites/fakes.js";

const RECEIVED = "2026-10-10T02:14:52Z";
const ASKED = "2026-10-10T02:15:10Z";
const USER = "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7";
const unsure = (): VerificationResult => fixture<VerificationResult>("verification_result.jdh-confirm");

let journal: Journal;
let reports: FakeReportRepository;
let sites: FakeSiteRepository;

beforeEach(() => {
  journal = new Journal();
  reports = new FakeReportRepository();
  sites = new FakeSiteRepository();
  reports.put(Report.receive(upload(), RECEIVED, USER).toRecord());
});

function siteMerger(): ReportMerger {
  const merger = new SiteMerger({
    sites,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(new FakeEmbeddings()),
    reports: new FakeReportStatus(),
    scores: new FakeScoreSeeder(),
    clock: new SiteClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia("https://cdn.example")),
    retry: new ConflictRetry(),
  });
  return new SiteReportMerger(merger, new NearPlacesFinder([]), new BinLocator({ bins: [], mappedTowns: [] }, 3000));
}

function pipeline(merge: PipelineStep = new MergeStep(siteMerger())): ReportPipeline {
  const steps: PipelineStep[] = [
    new ModerateStep(new FakeModerator(journal)),
    new VerifyStep(new FakeVerifier(journal, unsure()), new ReporterReputation(new FakeReputationReader()), new FakeNearbyCounter(), confirmWindow(ASKED)),
    new BrandsStep(new FakeBrandReader(journal)),
    new LocateStep(new FakeLocator(journal)),
    merge,
  ];
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "worker", stage: "dev" });
  return new ReportPipeline({ steps, reports, clock: new FixedClock("2026-10-10T03:00:00Z"), logger });
}

const delivery = (reportId = "rpt_jdh_1") => new QueueMessage({ kind: "report", report_id: reportId }, 1, 3);

// What POST /reports/{id}/confirm with {"sure": true} leaves in the table.
function confirmSure(): void {
  const report = Report.fromRecord(reports.stored("rpt_jdh_1"));
  expect(report.answerConfirmation(true, "2026-10-10T04:00:00Z")).toBe("recorded");
  reports.put({ ...report.toRecord(), version: report.version });
}

describe("ReportPipeline with an unsure judge", () => {
  it("asks the reporter and stops before brands, locate and merge, with a 24 h window", async () => {
    await pipeline().handle(delivery());
    expect(journal.calls).toEqual(["moderate", "verify"]);
    const stored = reports.stored("rpt_jdh_1");
    expect(stored).toMatchObject({ status: "needs_confirmation", completed_steps: ["moderate", "verify"] });
    expect(stored.site_id).toBeUndefined();
    expect(stored.confirmation).toEqual({
      question: "Our check wasn't sure this shows a waste dump. Only report it if you're 100% sure.",
      reasoning: unsure().judge?.rationale,
      report_type: "waste_dump",
      asked_at: ASKED,
      expires_at: "2026-10-11T02:15:10Z",
      answer: null,
      answered_at: null,
    });
    expect(sites.saves).toBe(0);
  });

  it("ignores a repeat delivery while the reporter has not answered", async () => {
    await pipeline().handle(delivery());
    await pipeline().handle(delivery());
    expect(journal.calls).toEqual(["moderate", "verify"]);
  });

  it("resumes a confirmed report and merges it as an unverified backer photo, never auto-verified", async () => {
    await pipeline().handle(delivery());
    confirmSure();
    await pipeline().handle(delivery());
    expect(journal.calls).toEqual(["moderate", "verify", "brands", "locate"]);
    const stored = reports.stored("rpt_jdh_1");
    expect(stored).toMatchObject({ status: "unverified", site_id: "site_jdh_1", confirmation: { answer: "sure" } });
    expect(stored.verification_result?.decision).toBe("needs_confirmation");
    const site = await sites.get("site_jdh_1");
    expect(site?.verification).toBe("unverified");
    expect(sites.feature("site_jdh_1").properties.backers).toMatchObject({ count: 1, photo_people: 1, needed: 10 });
  });

  it("finishes a confirmed report as unverified when no merge result exists", async () => {
    await pipeline(new SkippedStep("merge")).handle(delivery());
    confirmSure();
    await pipeline(new SkippedStep("merge")).handle(delivery());
    expect(reports.stored("rpt_jdh_1").status).toBe("unverified");
  });

  it("refuses to finish a needs_confirmation verification the reporter never confirmed", () => {
    const report = Report.receive(upload(), RECEIVED, USER);
    report.start(ASKED);
    report.recordVerification(unsure(), { askedAt: ASKED, expiresAt: "2026-10-11T02:15:10Z" });
    expect(() => Report.fromRecord({ ...report.toRecord(), status: "processing" }).finish(ASKED)).toThrow(InternalDataError);
  });

  it("refuses to ask without a window", () => {
    const report = Report.receive(upload(), RECEIVED, USER);
    expect(() => report.recordVerification(unsure())).toThrow(InternalDataError);
  });
});

describe("an unsure judge on a scan frame", () => {
  it("rejects the frame without asking, and the scan reads it as not_waste", async () => {
    const frame = { ...upload(), upload_id: "upl_frame_0", capture_mode: "scan" as const, scan: { scan_id: "scn_jdh_6", t_ms: 0 } };
    reports.put(Report.receive(frame, RECEIVED, USER).toRecord());
    await pipeline().handle(delivery("rpt_frame_0"));
    const stored = reports.stored("rpt_frame_0");
    expect(stored.status).toBe("rejected");
    expect(stored.confirmation).toBeUndefined();
    const found = new ScanFindings(new PublicMedia("https://cdn.example")).of([stored]);
    expect(found.frames.map((finding) => finding.result)).toEqual(["not_waste"]);
    expect(found.sites).toBe(0);
  });
});

describe("MergeableReportFactory and needs_confirmation", () => {
  const factory = new MergeableReportFactory(new PublicMedia("https://cdn.example"));
  const asked = () => {
    const base = evidence();
    return { ...base, verification: { ...base.verification, decision: "needs_confirmation" as const } };
  };

  it("merges only once the reporter answered sure", () => {
    expect(() => factory.create(asked())).toThrow(InternalDataError);
    expect(() => factory.create({ ...asked(), reporterConfirmed: false })).toThrow(InternalDataError);
    expect(factory.create({ ...asked(), reporterConfirmed: true }).reportId).toBe("rpt_jdh_1");
  });
});

describe("CONFIRM_TTL_HOURS", () => {
  const env = {
    REPORTS_TABLE: "r",
    DEVICES_TABLE: "d",
    USERS_TABLE: "u",
    REPORTS_QUEUE_URL: "https://sqs.example/q",
    ML_URL: "http://ml:8000",
  };

  it("defaults to 24 hours and reads the variable", () => {
    expect(ReportWorkerSettings.fromEnv(env).confirmTtlHours).toBe(24);
    expect(ReportWorkerSettings.fromEnv({ ...env, CONFIRM_TTL_HOURS: "48" }).confirmTtlHours).toBe(48);
  });

  it("opens a window that many hours long", () => {
    expect(confirmWindow("2026-10-10T02:15:10Z", 48).open()).toEqual({ askedAt: "2026-10-10T02:15:10Z", expiresAt: "2026-10-12T02:15:10Z" });
  });
});
