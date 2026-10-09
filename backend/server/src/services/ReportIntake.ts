import type { ReportUpload } from "../contracts/index.gen.js";
import { InternalDataError, ValidationError } from "../domain/errors.js";
import { Report } from "../domain/Report.js";
import { ReportId } from "../domain/ReportId.js";
import { isoSeconds } from "../domain/timeUtils.js";
import type { Clock } from "../ports/Clock.js";
import type { ReportQueue } from "../ports/ReportQueue.js";
import type { ReportRepository } from "../ports/ReportRepository.js";
import type { SnapLimit } from "./SnapLimit.js";

// The queue's visibility timeout: before it passes, the first message may still be in flight or being handled.
const REQUEUE_AFTER_MS = 300_000;

export interface IntakePorts {
  readonly reports: ReportRepository;
  readonly snapLimit: SnapLimit;
  readonly queue: ReportQueue;
  readonly clock: Clock;
}

// The contract's 202 body always says queued; GET /reports/{id} gives the live status.
export interface AcceptedReport {
  readonly report_id: string;
  readonly status: "queued";
}

// POST /reports: snap photos only (the worker writes scan frames), idempotent per upload id.
export class ReportIntake {
  readonly #ports: IntakePorts;

  constructor(ports: IntakePorts) {
    this.#ports = ports;
  }

  async submit(upload: ReportUpload, userId?: string): Promise<AcceptedReport> {
    if (upload.capture_mode !== "snap") {
      throw new ValidationError("POST /reports takes snap photos only; the worker makes scan frames");
    }
    const reportId = ReportId.fromUpload(upload.upload_id).value;
    const existing = await this.#ports.reports.get(reportId);
    if (existing !== undefined) {
      return this.#resubmit(existing, upload, userId);
    }
    const now = this.#ports.clock.now();
    await this.#ports.snapLimit.check({ deviceToken: upload.device_token, userId }, now);
    const report = Report.receive(upload, isoSeconds(now), userId);
    if (!(await this.#ports.reports.create(report))) {
      return this.#resubmit(await this.#load(reportId), upload, userId);
    }
    await this.#ports.queue.sendReport(report.id);
    return { report_id: report.id, status: "queued" };
  }

  // A retry is never counted; it re-sends only a report still queued after the visibility timeout, whose message was lost.
  async #resubmit(report: Report, upload: ReportUpload, userId?: string): Promise<AcceptedReport> {
    if (!report.isOwnedBy({ deviceToken: upload.device_token, userId })) {
      throw new ValidationError("upload_id was already used for another report");
    }
    const cutoff = isoSeconds(new Date(this.#ports.clock.now().getTime() - REQUEUE_AFTER_MS));
    if (report.isQueuedSince(cutoff)) {
      await this.#ports.queue.sendReport(report.id);
    }
    return { report_id: report.id, status: "queued" };
  }

  async #load(reportId: string): Promise<Report> {
    const report = await this.#ports.reports.get(reportId);
    if (report === undefined) {
      throw new InternalDataError(`report ${reportId} was neither created nor found`);
    }
    return report;
  }
}
