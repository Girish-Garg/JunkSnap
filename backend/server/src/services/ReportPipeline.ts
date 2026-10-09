import { InternalDataError } from "../domain/errors.js";
import type { QueueMessage } from "../domain/QueueMessage.js";
import type { Report } from "../domain/Report.js";
import { ReportId } from "../domain/ReportId.js";
import { isoSeconds } from "../domain/timeUtils.js";
import type { Clock } from "../ports/Clock.js";
import type { Logger } from "../ports/Logger.js";
import type { MessageHandler } from "../ports/MessageHandler.js";
import type { PipelineStep } from "../ports/PipelineStep.js";
import type { ReportRepository } from "../ports/ReportRepository.js";

export interface PipelinePorts {
  readonly steps: readonly PipelineStep[];
  readonly reports: ReportRepository;
  readonly clock: Clock;
  readonly logger: Logger;
}

// Runs the steps in order, saving after each so a retry skips finished steps; stops once the report is settled.
export class ReportPipeline implements MessageHandler {
  readonly #ports: PipelinePorts;

  constructor(ports: PipelinePorts) {
    this.#ports = ports;
  }

  async handle(message: QueueMessage): Promise<void> {
    const report = await this.#load(ReportId.parse(message.field("report_id")).value);
    if (report.isSettled()) {
      this.#ports.logger.info({ report_id: report.id, status: report.status }, "report already settled");
      return;
    }
    try {
      await this.#run(report);
    } catch (error) {
      await this.#giveUpOnLastAttempt(report, message);
      throw error;
    }
  }

  async #run(report: Report): Promise<void> {
    if (report.start(this.#now())) {
      await this.#ports.reports.save(report);
    }
    for (const step of this.#ports.steps) {
      if (report.isSettled()) {
        return;
      }
      if (!report.hasCompleted(step.name)) {
        await step.run(report);
        report.completeStep(step.name, this.#now());
        await this.#ports.reports.save(report);
      }
    }
    if (!report.isSettled()) {
      report.finish(this.#now());
      await this.#ports.reports.save(report);
    }
  }

  // The phone never waits forever: the last failed receive leaves the report needs_review before the DLQ.
  async #giveUpOnLastAttempt(report: Report, message: QueueMessage): Promise<void> {
    if (!message.isLastAttempt()) {
      return;
    }
    report.markNeedsReview(this.#now());
    const fields = { report_id: report.id, receive_count: message.receiveCount };
    try {
      await this.#ports.reports.save(report);
      this.#ports.logger.warn(fields, "report needs review");
    } catch (error) {
      this.#ports.logger.error({ ...fields, error }, "could not mark the report needs_review");
    }
  }

  async #load(reportId: string): Promise<Report> {
    const report = await this.#ports.reports.get(reportId);
    if (report === undefined) {
      throw new InternalDataError(`report ${reportId} is not in the reports table`);
    }
    return report;
  }

  #now(): string {
    return isoSeconds(this.#ports.clock.now());
  }
}
