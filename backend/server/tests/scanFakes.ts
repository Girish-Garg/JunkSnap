import { createHash } from "node:crypto";
import { copyFile, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import type { ScanSession } from "../src/contracts/scanSessionPending.js";
import { FrameHash } from "../src/domain/FrameHash.js";
import type { ScanRecord, ScanUpdate } from "../src/domain/ScanRecord.js";
import { InvalidVideoError } from "../src/domain/scanErrors.js";
import type { FrameHasher } from "../src/ports/FrameHasher.js";
import type { FrameReportRepository, QueuedFrameReport } from "../src/ports/FrameReportRepository.js";
import type { DownloadedVideo, ScanMediaStore } from "../src/ports/ScanMediaStore.js";
import type { ScanQueue } from "../src/ports/ScanQueue.js";
import type { ScanRepository } from "../src/ports/ScanRepository.js";
import type { ScanUploadSigner, SignedUpload, VideoUpload } from "../src/ports/ScanUploadSigner.js";
import type { ScratchSpace } from "../src/ports/ScratchSpace.js";
import type { ExtractedFrame, VideoFrameReader, VideoSize } from "../src/ports/VideoFrameReader.js";
import { LogSink } from "./LogSink.js";

export const NOW = new Date("2026-10-10T04:02:20Z");
export const VIDEO_SHA = "58a6b635872943aba34889e6e3c9fc117067b42f79f064042afe57d7e2046f18";

// The scan_session fixture drafted for contracts PR #39 (sample jpr-1).
export function sampleSession(overrides: Partial<ScanSession> = {}): ScanSession {
  const track = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((second) => ({
    t_ms: second * 1000,
    lat: 26.85297,
    lon: 75.81542 + second * 0.00005,
    accuracy_m: 14,
    speed_mps: 5,
    heading: 90,
  }));
  return {
    scan_id: "scn_jpr_1",
    device_token: "a71e5c90-2d3b-4f86-b1c4-9e0d27f58a63",
    user_id: "c8a1f3e6-2b94-4d70-8e5f-1a6b9d3c7e20",
    report_type: "open_construction",
    context: "uncovered_debris",
    started_at: "2026-10-10T04:02:06Z",
    ended_at: "2026-10-10T04:02:14Z",
    duration_ms: 8000,
    video_key: "scans/scn_jpr_1.webm",
    video_sha256: VIDEO_SHA,
    gps_track: track,
    hints: {
      model: "yolo-junk-nano-v0",
      detections: [
        { t_ms: 3600, score: 0.64, box: { left: 0.52, top: 0.48, width: 0.3, height: 0.28 } },
        { t_ms: 4000, score: 0.77, box: { left: 0.44, top: 0.46, width: 0.36, height: 0.31 } },
      ],
    },
    ...overrides,
  };
}

export function queuedRecord(session: ScanSession = sampleSession()): ScanRecord {
  const at = NOW.toISOString();
  return { ...session, received_at: at, status: "queued", reason: null, frames: null, report_ids: [], updated_at: at };
}

export function testLogger(sink = new LogSink()) {
  return new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
}

export class FakeScanRepository implements ScanRepository {
  readonly rows = new Map<string, ScanRecord>();
  readonly updates: ScanUpdate[] = [];

  async create(record: ScanRecord): Promise<boolean> {
    if (this.rows.has(record.scan_id)) {
      return false;
    }
    this.rows.set(record.scan_id, record);
    return true;
  }

  async find(scanId: string): Promise<ScanRecord | undefined> {
    return this.rows.get(scanId);
  }

  async update(scanId: string, update: ScanUpdate): Promise<void> {
    const row = this.rows.get(scanId);
    if (row === undefined) {
      throw new Error(`no scan ${scanId}`);
    }
    this.rows.set(scanId, { ...row, ...update });
    this.updates.push(update);
  }
}

export class FakeScanQueue implements ScanQueue {
  readonly messages: Record<string, string>[] = [];
  failReports = false;

  async sendScan(scanId: string): Promise<void> {
    this.messages.push({ kind: "scan", scan_id: scanId });
  }

  async sendReport(reportId: string): Promise<void> {
    if (this.failReports) {
      throw new Error("queue unreachable");
    }
    this.messages.push({ kind: "report", report_id: reportId });
  }
}

export class FakeUploadSigner implements ScanUploadSigner {
  readonly uploads: VideoUpload[] = [];

  async sign(upload: VideoUpload): Promise<SignedUpload> {
    this.uploads.push(upload);
    return { url: `https://originals.example/${upload.key}?signed`, headers: { "Content-Type": upload.contentType } };
  }
}

// Serves one video: a canned download result, a real local file copied into place, or null for none.
export class FakeMediaStore implements ScanMediaStore {
  readonly originals = new Map<string, { readonly jpeg: Uint8Array; readonly sha256: string }>();
  readonly #video: DownloadedVideo | string | null;

  constructor(video: DownloadedVideo | string | null = { bytes: 9_400_000, sha256Hex: VIDEO_SHA }) {
    this.#video = video;
  }

  async downloadVideo(key: string, toPath: string): Promise<DownloadedVideo> {
    if (this.#video === null) {
      throw new InvalidVideoError(`No video was uploaded at ${key}`);
    }
    if (typeof this.#video !== "string") {
      return this.#video;
    }
    await copyFile(this.#video, toPath);
    const bytes = await readFile(toPath);
    return { bytes: bytes.length, sha256Hex: createHash("sha256").update(bytes).digest("hex") };
  }

  async putOriginal(key: string, jpeg: Uint8Array, sha256: string): Promise<void> {
    this.originals.set(key, { jpeg, sha256 });
  }
}

export class FakeVideoFrameReader implements VideoFrameReader {
  readonly extracted: number[][] = [];
  readonly #size: VideoSize;
  readonly #missing: ReadonlySet<number>;

  constructor(size: VideoSize = { width: 1280, height: 720 }, missingTimes: readonly number[] = []) {
    this.#size = size;
    this.#missing = new Set(missingTimes);
  }

  async probe(): Promise<VideoSize> {
    return this.#size;
  }

  async extract(_videoPath: string, timesMs: readonly number[], outDir: string): Promise<ExtractedFrame[]> {
    this.extracted.push([...timesMs]);
    return timesMs.filter((tMs) => !this.#missing.has(tMs)).map((tMs) => ({ tMs, path: join(outDir, `frame-${tMs}.jpg`) }));
  }
}

// Hashes by frame time; by default every frame looks different from every other.
export class FakeFrameHasher implements FrameHasher {
  readonly #bitsFor: (tMs: number) => bigint;

  constructor(bitsFor: (tMs: number) => bigint = (tMs) => BigInt(tMs + 1) * 0x9e3779b97f4a7c15n) {
    this.#bitsFor = bitsFor;
  }

  async hash(jpegPath: string): Promise<FrameHash> {
    const tMs = Number(/frame-(\d+)\.jpg$/.exec(basename(jpegPath))?.[1]);
    return new FrameHash(this.#bitsFor(tMs));
  }
}

export class FakeFrameReportRepository implements FrameReportRepository {
  readonly rows = new Map<string, QueuedFrameReport>();

  async exists(reportId: string): Promise<boolean> {
    return this.rows.has(reportId);
  }

  async createQueued(report: QueuedFrameReport): Promise<void> {
    if (!this.rows.has(report.report_id)) {
      this.rows.set(report.report_id, report);
    }
  }
}

export class FakeScratchSpace implements ScratchSpace {
  readonly created: string[] = [];
  readonly removed: string[] = [];

  async create(label: string): Promise<string> {
    const dir = `/scratch/${label}`;
    this.created.push(dir);
    return dir;
  }

  async read(path: string): Promise<Uint8Array> {
    return Buffer.from(`jpeg bytes of ${basename(path)}`);
  }

  async remove(dir: string): Promise<void> {
    this.removed.push(dir);
  }
}
