import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { validateReportUpload, type ScanSession } from "../src/contracts/index.gen.js";
import { ExternalServiceError, InternalDataError } from "../src/domain/errors.js";
import { ScanFrameId } from "../src/domain/ScanFrameId.js";
import { ScanRequestParser } from "../src/handlers/ScanRequestParser.js";
import type { DownloadedVideo } from "../src/ports/ScanMediaStore.js";
import type { VideoInfo } from "../src/ports/VideoFrameReader.js";
import { FramePlanner } from "../src/services/FramePlanner.js";
import { FrameSelector } from "../src/services/FrameSelector.js";
import { ScanFramePublisher } from "../src/services/ScanFramePublisher.js";
import { ScanFrameSampler } from "../src/services/ScanFrameSampler.js";
import { ScanVideoLoader } from "../src/services/ScanVideoLoader.js";
import { VideoScanProcessor } from "../src/services/VideoScanProcessor.js";
import { LogSink } from "./LogSink.js";
import {
  FakeFrameHasher,
  FakeFrameReportRepository,
  FakeMediaStore,
  FakeScanQueue,
  FakeScanRepository,
  FakeScratchSpace,
  FakeVideoFrameReader,
  NOW,
  queuedRecord,
  sampleSession,
  scanFixture,
  testLogger,
  USER_ID,
} from "./scanFakes.js";

// The reports table becomes unreachable right after the first row is written.
class ReportsLostAfterFirstWrite extends FakeFrameReportRepository {
  override async exists(reportId: string): Promise<boolean> {
    if (this.rows.size > 0) {
      throw new ExternalServiceError("Could not read the report");
    }
    return super.exists(reportId);
  }
}

// A duplicate delivery of the same scan finishes it while this delivery's frame message fails.
class FinishedElsewhereQueue extends FakeScanQueue {
  readonly #elsewhere: () => Promise<void>;

  constructor(elsewhere: () => Promise<void>) {
    super();
    this.#elsewhere = elsewhere;
  }

  override async sendReport(): Promise<void> {
    await this.#elsewhere();
    throw new Error("queue unreachable");
  }
}

interface Setup {
  readonly session?: ScanSession;
  readonly video?: DownloadedVideo | null;
  readonly info?: Partial<VideoInfo>;
  readonly failAt?: number;
  readonly bitsFor?: (tMs: number) => bigint;
}

let scans: FakeScanRepository;
let media: FakeMediaStore;
let reader: FakeVideoFrameReader;
let reports: FakeFrameReportRepository;
let queue: FakeScanQueue;
let scratch: FakeScratchSpace;
let sink: LogSink;

function processor(setup: Setup = {}): VideoScanProcessor {
  scans.rows.set("scn_jpr_1", queuedRecord(setup.session));
  media = new FakeMediaStore(setup.video);
  reader = new FakeVideoFrameReader(setup.info, setup.failAt);
  const now = (): Date => NOW;
  const tools = { reader, hasher: new FakeFrameHasher(setup.bitsFor), planner: new FramePlanner(), selector: new FrameSelector() };
  const publisher = new ScanFramePublisher({ media, reports, queue, scratch }, now);
  const loader = new ScanVideoLoader(media, reader);
  const sampler = new ScanFrameSampler(tools);
  return new VideoScanProcessor({ scans, scratch, loader, sampler, publisher, logger: testLogger(sink), now });
}

beforeEach(() => {
  scans = new FakeScanRepository();
  reports = new FakeFrameReportRepository();
  queue = new FakeScanQueue();
  scratch = new FakeScratchSpace();
  sink = new LogSink();
});

const VIDEO = { bytes: 9_400_000, sha256Hex: sampleSession().video_sha256 };

describe("VideoScanProcessor", () => {
  it("turns each kept frame into a queued capture_mode scan report and marks the scan done", async () => {
    await processor({ video: VIDEO }).process("scn_jpr_1");
    const scan = scans.rows.get("scn_jpr_1");
    expect(scan).toMatchObject({ status: "done", reason: null, frames: { sampled: 9, kept: 8, dropped_no_fix: 0 } });
    expect(scans.updates.map((update) => update.status)).toEqual(["processing", "done"]);
    const keptTimes = [0, 1000, 2000, 3600, 4000, 5000, 6000, 7000];
    const ids = keptTimes.map((tMs) => ScanFrameId.of("scn_jpr_1", tMs));
    expect(scan?.report_ids).toEqual(ids.map((id) => id.reportId));
    expect(queue.messages).toEqual(ids.map((id) => ({ kind: "report", report_id: id.reportId })));
    expect([...media.originals.keys()]).toEqual(ids.map((id) => id.originalKey));
    expect(scratch.removed).toEqual(["/scratch/scn_jpr_1"]);
  });

  it("writes report_upload fields from the session, the frame time and the interpolated GPS", async () => {
    await processor({ video: VIDEO }).process("scn_jpr_1");
    const id = ScanFrameId.of("scn_jpr_1", 3600);
    const jpeg = Buffer.from("jpeg bytes of frame-3600.jpg");
    const sha256 = createHash("sha256").update(jpeg).digest("hex");
    expect(reports.rows.get(id.reportId)).toEqual({
      report_id: id.reportId,
      received_at: NOW.toISOString(),
      // 18 m from the first frame, so still the first spot.
      scan_spot: 0,
      upload: {
        upload_id: id.uploadId,
        report_type: "open_construction",
        context: "uncovered_debris",
        capture_mode: "scan",
        scan: { scan_id: "scn_jpr_1", t_ms: 3600 },
        sha256,
        gps: { lat: 26.85297, lon: 75.81560, accuracy_m: 14 },
        device_token: "a71e5c90-2d3b-4f86-b1c4-9e0d27f58a63",
        captured_at: "2026-10-10T04:02:09.600Z",
        user_id: "c8a1f3e6-2b94-4d70-8e5f-1a6b9d3c7e20",
        hints: { model: "yolo-junk-nano-v0", waste_score: 0.64, recall_audit: false },
      },
    });
    expect(media.originals.get(id.originalKey)).toEqual({ jpeg, sha256 });
    const plain = reports.rows.get(ScanFrameId.of("scn_jpr_1", 5000).reportId);
    expect(plain?.upload).not.toHaveProperty("hints");
    const hinted = reports.rows.get(id.reportId);
    expect(validateReportUpload(hinted?.upload)).toEqual(hinted?.upload);
    expect(validateReportUpload(plain?.upload)).toEqual(plain?.upload);
  });

  it("groups frames into spots of 20 m around each spot's first frame", async () => {
    await processor({ video: VIDEO }).process("scn_jpr_1");
    const spotOf = (tMs: number) => reports.rows.get(ScanFrameId.of("scn_jpr_1", tMs).reportId)?.scan_spot;
    expect([0, 1000, 2000, 3600, 4000, 5000, 6000, 7000].map(spotOf)).toEqual([0, 0, 0, 0, 0, 5000, 5000, 5000]);
  });

  it("gives an area scout's frames a concrete placeholder claim and lets the models name type and context", async () => {
    const session = sampleSession({ report_type: "auto", context: "auto" });
    await processor({ video: VIDEO, session }).process("scn_jpr_1");
    const rows = [...reports.rows.values()];
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row).toMatchObject({ auto_claim: "type", upload: { report_type: "waste_dump", context: "other" } });
      expect(() => validateReportUpload(row.upload)).not.toThrow();
    }
  });

  it("lets the models name only the place when the person picked the type", async () => {
    const session = sampleSession({ report_type: "overflowing_bin", context: "auto" });
    await processor({ video: VIDEO, session }).process("scn_jpr_1");
    const row = [...reports.rows.values()][0];
    expect(row).toMatchObject({ auto_claim: "context", upload: { report_type: "overflowing_bin", context: "overflowing" } });
  });

  it("parses the scan_session.jpr-1 fixture and turns it into rows that pass the report_upload contract", async () => {
    const parsed = new ScanRequestParser().session(scanFixture());
    expect(parsed).not.toHaveProperty("user_id");
    expect({ ...parsed, user_id: USER_ID }).toEqual(scanFixture());
    await processor({ video: VIDEO, session: { ...parsed, user_id: USER_ID } }).process("scn_jpr_1");
    const rows = [...reports.rows.values()];
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(() => validateReportUpload(row.upload)).not.toThrow();
    }
  });

  it("plans frames only within the real video when it is shorter than the session claims", async () => {
    await processor({ video: VIDEO, info: { lastFrameMs: 4500 } }).process("scn_jpr_1");
    expect(reader.extracted).toEqual([[0, 1000, 2000, 3000, 3600, 4000]]);
    expect(scans.rows.get("scn_jpr_1")).toMatchObject({ status: "done", frames: { sampled: 6, kept: 5, dropped_no_fix: 0 } });
  });

  it("rethrows a failed cut for SQS to retry and never marks the scan done with frames missing", async () => {
    await expect(processor({ video: VIDEO, failAt: 3000 }).process("scn_jpr_1")).rejects.toThrow(ExternalServiceError);
    expect(scans.rows.get("scn_jpr_1")?.status).toBe("processing");
    expect(reports.rows.size).toBe(0);
    expect(queue.messages).toHaveLength(0);
    expect(scratch.removed).toEqual(["/scratch/scn_jpr_1"]);
  });

  it("drops frames without a usable fix before cutting them and counts them", async () => {
    const track = sampleSession().gps_track.map((fix) => (fix.t_ms >= 5000 ? { ...fix, accuracy_m: 65 } : fix));
    await processor({ video: VIDEO, session: sampleSession({ gps_track: track }) }).process("scn_jpr_1");
    expect(reader.extracted).toEqual([[0, 1000, 2000, 3000, 3600, 4000]]);
    expect(scans.rows.get("scn_jpr_1")?.frames).toEqual({ sampled: 9, kept: 5, dropped_no_fix: 3 });
  });

  it("skips near-duplicate frames, such as a stop at a junction", async () => {
    const still = (tMs: number): bigint => (tMs >= 2000 && tMs <= 6000 ? 0xff00ff00n : BigInt(tMs + 1) * 0x9e3779b97f4a7c15n);
    await processor({ video: VIDEO, bitsFor: still, session: sampleSession({ hints: undefined }) }).process("scn_jpr_1");
    const times = (scans.rows.get("scn_jpr_1")?.report_ids ?? []).length;
    expect(times).toBe(4);
    expect(scans.rows.get("scn_jpr_1")?.frames).toEqual({ sampled: 8, kept: 4, dropped_no_fix: 0 });
  });

  it.each([
    ["the video was never uploaded", { video: null }, "No video was uploaded"],
    ["the bytes do not match the checksum", { video: { ...VIDEO, sha256Hex: "0".repeat(64) } }, "do not match video_sha256"],
    ["the video is over 40 MB", { video: { ...VIDEO, bytes: 40 * 1024 * 1024 + 1 } }, "the limit is"],
    ["the video is larger than 720p", { video: VIDEO, info: { width: 1920, height: 1080 } }, "1920x1080"],
    ["the video really runs past 60 s", { video: VIDEO, info: { lastFrameMs: 60_033 } }, "the limit is 60000 ms"],
  ])("fails the scan for good with invalid_video when %s", async (_case, setup, detail) => {
    await processor(setup).process("scn_jpr_1");
    expect(scans.rows.get("scn_jpr_1")).toMatchObject({ status: "failed", reason: "invalid_video" });
    expect(queue.messages).toHaveLength(0);
    expect(scratch.removed).toEqual(["/scratch/scn_jpr_1"]);
    const warning = sink.records().find((record) => record.message === "scan failed");
    expect(warning).toMatchObject({ level: "WARN", scan_id: "scn_jpr_1", reason: "invalid_video" });
    expect(String(warning?.detail)).toContain(detail);
  });

  it("accepts a portrait 720 by 1280 video", async () => {
    await processor({ video: VIDEO, info: { width: 720, height: 1280 } }).process("scn_jpr_1");
    expect(scans.rows.get("scn_jpr_1")?.status).toBe("done");
  });

  it("rethrows a transient failure for SQS to retry, keeps the scan processing and still cleans up", async () => {
    const scanProcessor = processor({ video: VIDEO });
    queue.failReports = true;
    await expect(scanProcessor.process("scn_jpr_1")).rejects.toThrow("queue unreachable");
    expect(scans.rows.get("scn_jpr_1")?.status).toBe("processing");
    expect(scratch.removed).toEqual(["/scratch/scn_jpr_1"]);
  });

  it("on a retry keeps report rows it already wrote and sends every message again", async () => {
    const scanProcessor = processor({ video: VIDEO });
    queue.failReports = true;
    await expect(scanProcessor.process("scn_jpr_1")).rejects.toThrow();
    const firstRow = reports.rows.get(ScanFrameId.of("scn_jpr_1", 0).reportId);
    media.originals.clear();
    queue.failReports = false;
    await scanProcessor.process("scn_jpr_1");
    expect(reports.rows.get(ScanFrameId.of("scn_jpr_1", 0).reportId)).toBe(firstRow);
    expect(media.originals.has(ScanFrameId.of("scn_jpr_1", 0).originalKey)).toBe(false);
    expect(queue.messages).toHaveLength(8);
    expect(scans.rows.get("scn_jpr_1")?.status).toBe("done");
  });

  it("does nothing for a scan that already finished", async () => {
    const scanProcessor = processor({ video: VIDEO });
    await scanProcessor.process("scn_jpr_1");
    await scanProcessor.process("scn_jpr_1");
    expect(queue.messages).toHaveLength(8);
    expect(scratch.created).toHaveLength(1);
  });

  it("marks the scan failed with retries_exhausted when the worker gives up", async () => {
    expect(await processor().markExhausted("scn_jpr_1")).toBe(true);
    expect(scans.rows.get("scn_jpr_1")).toMatchObject({ status: "failed", reason: "retries_exhausted" });
  });

  it("never fails a scan that a duplicate delivery finished meanwhile", async () => {
    const scanProcessor = processor({ video: VIDEO });
    await scanProcessor.process("scn_jpr_1");
    expect(await scanProcessor.markExhausted("scn_jpr_1")).toBe(false);
    expect(scans.rows.get("scn_jpr_1")).toMatchObject({ status: "done", reason: null });
  });

  it("still lists the frames it queued when the scan ends failed with retries_exhausted", async () => {
    const scanProcessor = processor({ video: VIDEO });
    queue.reportsBeforeFailure = 3;
    await expect(scanProcessor.process("scn_jpr_1")).rejects.toThrow("queue unreachable");
    await scanProcessor.markExhausted("scn_jpr_1");
    // The fourth frame's row was written before its message failed, so it is listed too.
    const written = [0, 1000, 2000, 3600].map((tMs) => ScanFrameId.of("scn_jpr_1", tMs).reportId);
    expect(scans.rows.get("scn_jpr_1")).toMatchObject({ status: "failed", reason: "retries_exhausted", report_ids: written });
  });

  it("keeps listing the frames an earlier attempt wrote when a later attempt fails sooner", async () => {
    const scanProcessor = processor({ video: VIDEO });
    queue.reportsBeforeFailure = 4;
    await expect(scanProcessor.process("scn_jpr_1")).rejects.toThrow("queue unreachable");
    queue.failReports = true;
    await expect(scanProcessor.process("scn_jpr_1")).rejects.toThrow("queue unreachable");
    const written = [0, 1000, 2000, 3600, 4000].map((tMs) => ScanFrameId.of("scn_jpr_1", tMs).reportId);
    expect(scans.rows.get("scn_jpr_1")).toMatchObject({ status: "processing", report_ids: written });
  });

  it("leaves a scan that another delivery finished meanwhile done when this delivery's publish fails", async () => {
    const ids = [0, 1000, 2000, 3600, 4000, 5000, 6000, 7000].map((tMs) => ScanFrameId.of("scn_jpr_1", tMs).reportId);
    const frames = { sampled: 9, kept: 8, dropped_no_fix: 0 };
    const finished = { status: "done", reason: null, frames, report_ids: ids, updated_at: "2026-10-10T04:03:00Z" } as const;
    queue = new FinishedElsewhereQueue(() => scans.update("scn_jpr_1", finished));
    await expect(processor({ video: VIDEO }).process("scn_jpr_1")).rejects.toThrow("queue unreachable");
    expect(scans.rows.get("scn_jpr_1")).toMatchObject(finished);
    expect(sink.records().some((record) => record.message === "scan already finished; its report_ids stay as they are")).toBe(true);
  });

  it("still rethrows the publish error when it cannot record the frames already queued", async () => {
    reports = new ReportsLostAfterFirstWrite();
    const scanProcessor = processor({ video: VIDEO });
    queue.failReports = true;
    await expect(scanProcessor.process("scn_jpr_1")).rejects.toThrow("queue unreachable");
    expect(scans.rows.get("scn_jpr_1")).toMatchObject({ status: "processing", report_ids: [] });
    const warning = sink.records().find((record) => record.message === "could not record the frames already queued");
    expect(warning).toMatchObject({ level: "WARN", scan_id: "scn_jpr_1" });
  });

  it("throws for a scan id that is not in the table", async () => {
    await expect(processor().process("scn_missing")).rejects.toThrow(InternalDataError);
  });
});
