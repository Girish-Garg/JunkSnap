import { extname, join } from "node:path";
import { InternalDataError } from "../domain/errors.js";
import type { CandidateFrame } from "../domain/ScanFrame.js";
import type { ScanFailureReason, ScanFrameCounts, ScanRecord } from "../domain/ScanRecord.js";
import { InvalidVideoError } from "../domain/scanErrors.js";
import type { Logger } from "../ports/Logger.js";
import type { ScanRepository } from "../ports/ScanRepository.js";
import type { ScratchSpace } from "../ports/ScratchSpace.js";
import type { ScanFramePublisher } from "./ScanFramePublisher.js";
import type { ScanFrameSampler } from "./ScanFrameSampler.js";
import type { ScanVideoLoader } from "./ScanVideoLoader.js";

export interface ScanProcessorDeps {
  readonly scans: ScanRepository;
  readonly scratch: ScratchSpace;
  readonly loader: ScanVideoLoader;
  readonly sampler: ScanFrameSampler;
  readonly publisher: ScanFramePublisher;
  readonly logger: Logger;
  readonly now: () => Date;
}

interface ScanOutcome {
  readonly counts: ScanFrameCounts;
  readonly reportIds: readonly string[];
}

// Handles one kind scan message: private video to frames to queued scan reports, then removes its temp files.
export class VideoScanProcessor {
  readonly #deps: ScanProcessorDeps;

  constructor(deps: ScanProcessorDeps) {
    this.#deps = deps;
  }

  // Throws on transient failures so SQS retries; an invalid video fails the scan for good instead.
  async process(scanId: string): Promise<void> {
    const scan = await this.#deps.scans.find(scanId);
    if (scan === undefined) {
      throw new InternalDataError(`scan ${scanId} is not in the scans table`);
    }
    if (scan.status === "done" || scan.status === "failed") {
      this.#deps.logger.info({ scan_id: scanId, status: scan.status }, "scan already finished");
      return;
    }
    await this.#deps.scans.update(scanId, { status: "processing", reason: null, updated_at: this.#stamp() });
    await this.#inScratch(scan);
  }

  // For the worker once SQS has delivered the message for the last time.
  async markExhausted(scanId: string): Promise<void> {
    await this.#fail(scanId, "retries_exhausted", "no retries left");
  }

  async #inScratch(scan: ScanRecord): Promise<void> {
    const workDir = await this.#deps.scratch.create(scan.scan_id);
    try {
      await this.#finish(scan.scan_id, await this.#run(scan, workDir));
    } catch (error) {
      if (!(error instanceof InvalidVideoError)) {
        throw error;
      }
      await this.#fail(scan.scan_id, "invalid_video", error.message);
    } finally {
      await this.#deps.scratch.remove(workDir);
    }
  }

  async #run(scan: ScanRecord, workDir: string): Promise<ScanOutcome> {
    const videoPath = join(workDir, `video${extname(scan.video_key)}`);
    const { lastFrameMs } = await this.#deps.loader.load(scan, videoPath);
    const sampled = await this.#deps.sampler.sample(scan, { path: videoPath, lastFrameMs }, workDir);
    const reportIds = await this.#publish(scan, sampled.frames);
    return { counts: sampled.counts, reportIds };
  }

  // Frames are queued one at a time, so a scan that ends failed still lists the frames written before the failure.
  async #publish(scan: ScanRecord, frames: readonly CandidateFrame[]): Promise<readonly string[]> {
    try {
      return await this.#deps.publisher.publish(scan, frames);
    } catch (error) {
      await this.#keepWritten(scan, frames);
      throw error;
    }
  }

  // Best effort: SQS must see the publish error, not this one. A scan another delivery finished meanwhile stays as it is.
  async #keepWritten(scan: ScanRecord, frames: readonly CandidateFrame[]): Promise<void> {
    try {
      const reportIds = await this.#deps.publisher.writtenIds(scan, frames);
      if (!(await this.#deps.scans.recordReports(scan.scan_id, reportIds, this.#stamp()))) {
        this.#deps.logger.info({ scan_id: scan.scan_id }, "scan already finished; its report_ids stay as they are");
      }
    } catch (error) {
      this.#deps.logger.warn({ scan_id: scan.scan_id, error }, "could not record the frames already queued");
    }
  }

  async #finish(scanId: string, { counts, reportIds }: ScanOutcome): Promise<void> {
    const update = { status: "done", reason: null, frames: counts, report_ids: reportIds, updated_at: this.#stamp() } as const;
    await this.#deps.scans.update(scanId, update);
    this.#deps.logger.info({ scan_id: scanId, ...counts }, "scan processed");
  }

  // Leaves report_ids as stored, so a failed scan still lists the frames an earlier attempt queued.
  async #fail(scanId: string, reason: ScanFailureReason, detail: string): Promise<void> {
    await this.#deps.scans.update(scanId, { status: "failed", reason, updated_at: this.#stamp() });
    this.#deps.logger.warn({ scan_id: scanId, reason, detail }, "scan failed");
  }

  #stamp(): string {
    return this.#deps.now().toISOString();
  }
}
