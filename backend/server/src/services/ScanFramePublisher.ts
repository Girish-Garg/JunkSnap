import { createHash } from "node:crypto";
import type { ReportUpload, ScanSession } from "../contracts/index.gen.js";
import type { CandidateFrame } from "../domain/ScanFrame.js";
import { ScanFrameId } from "../domain/ScanFrameId.js";
import { ScanClaim } from "../domain/scout/ScanClaim.js";
import { ScanSpots } from "../domain/scout/ScanSpots.js";
import type { FrameReportRepository } from "../ports/FrameReportRepository.js";
import type { ScanMediaStore } from "../ports/ScanMediaStore.js";
import type { ScanQueue } from "../ports/ScanQueue.js";
import type { ScratchSpace } from "../ports/ScratchSpace.js";

export interface FramePublishPorts {
  readonly media: ScanMediaStore;
  readonly reports: FrameReportRepository;
  readonly queue: ScanQueue;
  readonly scratch: ScratchSpace;
}

// Turns each kept frame into a queued capture_mode scan report; the normal pipeline moderates and blurs it.
export class ScanFramePublisher {
  readonly #ports: FramePublishPorts;
  readonly #now: () => Date;

  constructor(ports: FramePublishPorts, now: () => Date) {
    this.#ports = ports;
    this.#now = now;
  }

  async publish(scan: ScanSession, frames: readonly CandidateFrame[]): Promise<string[]> {
    const spots = new ScanSpots().assign(frames);
    const reportIds: string[] = [];
    for (const frame of frames) {
      reportIds.push(await this.#publishOne(scan, frame, spots.get(frame.tMs) ?? frame.tMs));
    }
    return reportIds;
  }

  // Ids of the frames whose report rows exist, written by this attempt or an earlier one, in frame order.
  async writtenIds(scan: ScanSession, frames: readonly CandidateFrame[]): Promise<string[]> {
    const ids = frames.map((frame) => ScanFrameId.of(scan.scan_id, frame.tMs).reportId);
    const written = await Promise.all(ids.map((id) => this.#ports.reports.exists(id)));
    return ids.filter((_id, i) => written[i] === true);
  }

  // A retried scan keeps rows it already wrote but sends every message again; SQS is at least once anyway.
  async #publishOne(scan: ScanSession, frame: CandidateFrame, spot: number): Promise<string> {
    const id = ScanFrameId.of(scan.scan_id, frame.tMs);
    if (!(await this.#ports.reports.exists(id.reportId))) {
      const jpeg = await this.#ports.scratch.read(frame.path);
      const sha256 = createHash("sha256").update(jpeg).digest("hex");
      await this.#ports.media.putOriginal(id.originalKey, jpeg, sha256);
      const { claim, autoClaim } = new ScanClaim(scan).frame();
      const upload = { ...ScanFramePublisher.#upload(scan, frame, id, sha256), ...claim };
      const auto = autoClaim === undefined ? {} : { auto_claim: autoClaim };
      const row = { report_id: id.reportId, upload, received_at: this.#now().toISOString(), scan_spot: spot, ...auto };
      await this.#ports.reports.createQueued(row);
    }
    await this.#ports.queue.sendReport(id.reportId);
    return id.reportId;
  }

  static #upload(scan: ScanSession, frame: CandidateFrame, id: ScanFrameId, sha256: string): Omit<ReportUpload, "report_type" | "context"> {
    return {
      upload_id: id.uploadId,
      capture_mode: "scan",
      scan: { scan_id: scan.scan_id, t_ms: frame.tMs },
      sha256,
      gps: frame.gps,
      device_token: scan.device_token,
      captured_at: new Date(Date.parse(scan.started_at) + frame.tMs).toISOString(),
      ...(scan.user_id === undefined ? {} : { user_id: scan.user_id }),
      ...ScanFramePublisher.#hints(scan, frame),
    };
  }

  // The phone's detection at this frame travels as a hint for the pipeline, never as evidence.
  static #hints(scan: ScanSession, frame: CandidateFrame): Pick<ReportUpload, "hints"> {
    if (frame.hintScore === undefined || scan.hints === undefined) {
      return {};
    }
    return { hints: { model: scan.hints.model, waste_score: frame.hintScore, recall_audit: false } };
  }
}
