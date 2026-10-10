import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import type { VerificationResult } from "../../src/contracts/index.gen.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { QueueMessage } from "../../src/domain/QueueMessage.js";
import { Report } from "../../src/domain/Report.js";
import type { ReportRecord } from "../../src/domain/ReportRecord.js";
import type { AutoClaimKind } from "../../src/domain/scout/AutoClaim.js";
import { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import type { VerifyRequest } from "../../src/domain/VerifyRequest.js";
import type { MlVerifyClient } from "../../src/ports/MlVerifyClient.js";
import { BinLocator } from "../../src/services/BinLocator.js";
import { LocateStep } from "../../src/services/LocateStep.js";
import { MergeStep } from "../../src/services/MergeStep.js";
import { ModerateStep } from "../../src/services/ModerateStep.js";
import { NearPlacesFinder } from "../../src/services/NearPlacesFinder.js";
import { ReporterReputation } from "../../src/services/ReporterReputation.js";
import { ReportPipeline } from "../../src/services/ReportPipeline.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../src/services/sites/MergeTargetPicker.js";
import { MERGE_ATTEMPTS, SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { VerifyStep } from "../../src/services/VerifyStep.js";
import { SiteReportMerger } from "../../src/services/wiring/SiteReportMerger.js";
import { LogSink } from "../LogSink.js";
import {
  confirmWindow,
  FakeLocator,
  FakeModerator,
  FakeNearbyCounter,
  FakeReportRepository,
  FakeReputationReader,
  FixedClock,
  Journal,
  upload,
  verification,
} from "../reportFakes.js";
import { northOf, siteFixture } from "../sites/builders.js";
import { FakeEmbeddings, FakeReportStatus, FakeScoreSeeder, FakeSiteRepository, FakeVoteRepository, FixedClock as SiteClock } from "../sites/fakes.js";

const USER = "7d4e2a91-6c35-4b8f-9e10-3a5c8b2f6d47";
const SCAN = "scn_jdh_6";
const FRAMES = 7;
type Judge = VerificationResult["judge"];

// Answers like ml: every frame gets its own embedding, and no two frames look alike to the 0.88 cosine test.
class ScriptedVerifier implements MlVerifyClient {
  readonly requests: VerifyRequest[] = [];

  constructor(readonly answer: Partial<VerificationResult>) {}

  async verify(request: VerifyRequest): Promise<VerificationResult> {
    this.requests.push(request);
    const embedding_key = `embeddings/${request.report_id}.json`;
    return { ...verification(), ...this.answer, report_id: request.report_id, purpose: "report", embedding_key };
  }
}

const judge = (report_type: NonNullable<Judge>["report_type"], context: NonNullable<Judge>["context"]): Judge => ({
  report_type, context, burning: false, readable_brands: [], rationale: "sample",
});

// 7 one-second frames of a 6 s clip, within 10 m of each other, all from one signed-in person.
function frame(i: number, spot: number | undefined, autoClaim?: AutoClaimKind): ReportRecord {
  const base = { ...upload(), upload_id: `upl_frame_${i}`, capture_mode: "scan" as const, scan: { scan_id: SCAN, t_ms: i * 1000 } };
  const gps = { lat: northOf(i * 1.5), lon: upload().gps.lon, accuracy_m: 8 };
  const record = Report.receive({ ...base, report_type: "waste_dump", context: "roadside", gps }, "2026-10-10T05:11:50Z", USER).toRecord();
  return { ...record, ...(spot === undefined ? {} : { scan_spot: spot }), ...(autoClaim === undefined ? {} : { auto_claim: autoClaim }) };
}

let reports: FakeReportRepository;
let sites: FakeSiteRepository;
let embeddings: FakeEmbeddings;

beforeEach(() => {
  reports = new FakeReportRepository();
  sites = new FakeSiteRepository();
  embeddings = new FakeEmbeddings();
  for (let i = 0; i < FRAMES; i += 1) {
    embeddings.add(`embeddings/rpt_frame_${i}.json`, new EmbeddingVector(Array.from({ length: FRAMES }, (_v, j) => (i === j ? 1 : 0))));
  }
});

function pipeline(verifier: MlVerifyClient): ReportPipeline {
  const journal = new Journal();
  const merger = new SiteMerger({
    sites,
    votes: new FakeVoteRepository(),
    cells: new NgeohashCells(),
    picker: new MergeTargetPicker(embeddings),
    reports: new FakeReportStatus(),
    scores: new FakeScoreSeeder(),
    clock: new SiteClock(),
    reportFactory: new MergeableReportFactory(new PublicMedia("https://cdn.example")),
    retry: new ConflictRetry(MERGE_ATTEMPTS),
  });
  const bins = new BinLocator({ bins: [], mappedTowns: [] }, 3000);
  const steps = [
    new ModerateStep(new FakeModerator(journal)),
    new VerifyStep(verifier, new ReporterReputation(new FakeReputationReader()), new FakeNearbyCounter(), confirmWindow()),
    new LocateStep(new FakeLocator(journal)),
    new MergeStep(new SiteReportMerger(merger, new NearPlacesFinder([]), bins)),
  ];
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "worker", stage: "dev" });
  return new ReportPipeline({ steps, reports, clock: new FixedClock("2026-10-10T05:12:00Z"), logger });
}

// All 7 messages at once, as the worker polls them in one batch of 10 and handles them in parallel.
async function runAll(records: readonly ReportRecord[], verifier: MlVerifyClient): Promise<void> {
  records.forEach((record) => reports.put(record));
  const worker = pipeline(verifier);
  await Promise.all(records.map((record) => worker.handle(new QueueMessage({ kind: "report", report_id: record.report_id }, 1, 3))));
}

const sevenFrames = (spot: number | undefined, autoClaim?: AutoClaimKind) =>
  Array.from({ length: FRAMES }, (_v, i) => frame(i, spot, autoClaim));

describe("frames of one scan at one spot", () => {
  it("reproduces the field bug without a spot: 7 overlapping 1 of 10 sites from one person", async () => {
    await runAll(sevenFrames(undefined), new ScriptedVerifier({ decision: "community_check" }));
    expect(sites.count()).toBe(FRAMES);
  });

  it("make at most one site with one backer, even when merged at once with unlike embeddings", async () => {
    await runAll(sevenFrames(0), new ScriptedVerifier({ decision: "community_check" }));
    expect(sites.count()).toBe(1);
    const [siteId] = await sites.allIds();
    const properties = sites.feature(siteId ?? "").properties;
    expect(properties).toMatchObject({ report_count: FRAMES, backers: { count: 1, photo_people: 1 }, verification: "unverified" });
    expect(properties.site_id).toMatch(/^site_[0-9a-f]{26}$/);
    expect([...reports.records.values()].every((record) => record.site_id === properties.site_id)).toBe(true);
  });

  it.each([
    ["neighbours hid the spot's site", { verification: "rejected" }],
    ["the spot's site was removed", { status: "removed", removed_reason: "withdrawn", removed_at: "2026-10-10T05:20:00Z" }],
  ] as const)("found a site of their own when %s", async (_case, change) => {
    const spotId = `site_${createHash("sha256").update(`${SCAN}:0:waste_dump`).digest("hex").slice(0, 26)}`;
    const hidden = siteFixture("jdh-1");
    sites.putFeature({ ...hidden, properties: { ...hidden.properties, site_id: spotId, ...change } });
    await runAll([frame(0, 0)], new ScriptedVerifier({ decision: "community_check" }));
    expect(reports.stored("rpt_frame_0")).toMatchObject({ site_id: "site_frame_0", status: "unverified" });
  });

  it("make no site when the models reject every frame as not waste", async () => {
    await runAll(sevenFrames(0), new ScriptedVerifier({ decision: "rejected", judge: judge("not_waste", null) }));
    expect(sites.count()).toBe(0);
    expect([...reports.records.values()].map((record) => record.status)).toEqual(Array(FRAMES).fill("rejected"));
  });
});

describe("area scout frames", () => {
  it("ask ml with an auto claim and take on the type and context the judge found", async () => {
    const verifier = new ScriptedVerifier({ decision: "community_check", judge: judge("overflowing_bin", "damaged") });
    await runAll(sevenFrames(0, "type"), verifier);
    expect(verifier.requests[0]).toMatchObject({ report_type: "auto", context: "auto" });
    expect(sites.count()).toBe(1);
    const [siteId] = await sites.allIds();
    expect(sites.feature(siteId ?? "").properties).toMatchObject({ report_type: "overflowing_bin", context: "damaged", backers: { count: 1 } });
    expect(reports.stored("rpt_frame_3")).toMatchObject({ report_type: "overflowing_bin", context: "damaged", status: "unverified" });
  });

  it.each([
    ["not_waste", judge("not_waste", null)],
    ["no_bin, which only a person can assert", judge("no_bin", "no_bin")],
  ])("make nothing when the judge answers %s, even if the combiner let the frame through", async (_case, answer) => {
    await runAll(sevenFrames(0, "type"), new ScriptedVerifier({ decision: "community_check", judge: answer }));
    expect(sites.count()).toBe(0);
    expect(reports.stored("rpt_frame_0")).toMatchObject({ status: "rejected", report_type: "waste_dump" });
  });

  it("falls back to the type's context when the judge names none that fits", async () => {
    await runAll(sevenFrames(0, "type"), new ScriptedVerifier({ decision: "community_check", judge: judge("contaminated_water", null) }));
    expect(reports.stored("rpt_frame_0")).toMatchObject({ report_type: "contaminated_water", context: "stagnant" });
  });

  it.each(["community_check", "rejected"] as const)(
    "retries the frame when the judge could not answer (decision %s), rather than guessing or rejecting",
    async (decision) => {
      reports.put(frame(0, 0, "type"));
      const worker = pipeline(new ScriptedVerifier({ decision, judge: null }));
      await expect(worker.handle(new QueueMessage({ kind: "report", report_id: "rpt_frame_0" }, 1, 3))).rejects.toThrow(ExternalServiceError);
      expect(sites.count()).toBe(0);
      expect(reports.stored("rpt_frame_0").status).toBe("processing");
    },
  );

  it("marks the frame needs_review when the judge is still out on the last delivery", async () => {
    reports.put(frame(0, 0, "type"));
    const worker = pipeline(new ScriptedVerifier({ decision: "rejected", judge: null }));
    await expect(worker.handle(new QueueMessage({ kind: "report", report_id: "rpt_frame_0" }, 3, 3))).rejects.toThrow(ExternalServiceError);
    expect(reports.stored("rpt_frame_0").status).toBe("needs_review");
  });

  it("asks only for the place when the person picked the type, and keeps a judged context of that type", async () => {
    const verifier = new ScriptedVerifier({ decision: "community_check", judge: judge("waste_dump", "drain") });
    await runAll(sevenFrames(0, "context"), verifier);
    expect(verifier.requests[0]).toMatchObject({ report_type: "waste_dump", context: "auto" });
    expect(reports.stored("rpt_frame_0")).toMatchObject({ report_type: "waste_dump", context: "drain" });
  });
});
