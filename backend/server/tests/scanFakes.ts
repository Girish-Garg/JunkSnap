import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { validateScanSession, type ScanSession } from "../src/contracts/index.gen.js";
import { ExternalServiceError } from "../src/domain/errors.js";
import { FrameHash } from "../src/domain/FrameHash.js";
import type { GpsFix } from "../src/domain/ScanFrame.js";
import type { ScanRecord, ScanUpdate } from "../src/domain/ScanRecord.js";
import { InvalidVideoError } from "../src/domain/scanErrors.js";
import type { FrameHasher } from "../src/ports/FrameHasher.js";
import type { FrameReportRepository, QueuedFrameReport } from "../src/ports/FrameReportRepository.js";
import type { DownloadedVideo, ScanMediaStore } from "../src/ports/ScanMediaStore.js";
import type { ScanQueue } from "../src/ports/ScanQueue.js";
import type { ScanRepository } from "../src/ports/ScanRepository.js";
import type { ScanUploadSigner, SignedUpload, VideoUpload } from "../src/ports/ScanUploadSigner.js";
import type { ScratchSpace } from "../src/ports/ScratchSpace.js";
import type { ExtractedFrame, VideoFrameReader, VideoInfo } from "../src/ports/VideoFrameReader.js";
import { LogSink } from "./LogSink.js";

export const NOW = new Date("2026-10-10T04:02:20Z");
export const VIDEO_SHA = "58a6b635872943aba34889e6e3c9fc117067b42f79f064042afe57d7e2046f18";
export const USER_ID = "c8a1f3e6-2b94-4d70-8e5f-1a6b9d3c7e20";
const FIXTURE = new URL("../../../contracts/fixtures/scan_session.jpr-1.json", import.meta.url);

export function scanFixture(): unknown {
  return JSON.parse(readFileSync(FIXTURE, "utf8"));
}

// Tests may pass any GPS track, empty or out of order, to see it rejected.
type SessionOverrides = Omit<Partial<ScanSession>, "gps_track"> & { readonly gps_track?: readonly GpsFix[] };

// The contract's scan_session.jpr-1 fixture: an 8 s ride with a fix every second and two phone hints.
export function sampleSession(overrides: SessionOverrides = {}): ScanSession {
  return { ...validateScanSession(scanFixture()), ...overrides } as ScanSession;
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

// An 8 s 720p clip at 30 fps by default; failAt makes that one cut fail the way a killed ffmpeg does.
export class FakeVideoFrameReader implements VideoFrameReader {
  readonly extracted: number[][] = [];
  readonly #info: VideoInfo;
  readonly #failAt: number | undefined;

  constructor(info: Partial<VideoInfo> = {}, failAt?: number) {
    this.#info = { width: 1280, height: 720, lastFrameMs: 7966, ...info };
    this.#failAt = failAt;
  }

  async probe(): Promise<VideoInfo> {
    return this.#info;
  }

  async extract(_videoPath: string, timesMs: readonly number[], outDir: string): Promise<ExtractedFrame[]> {
    this.extracted.push([...timesMs]);
    if (this.#failAt !== undefined && timesMs.includes(this.#failAt)) {
      throw new ExternalServiceError(`ffmpeg was stopped by SIGKILL at ${this.#failAt} ms`);
    }
    return timesMs.map((tMs) => ({ tMs, path: join(outDir, `frame-${tMs}.jpg`) }));
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
