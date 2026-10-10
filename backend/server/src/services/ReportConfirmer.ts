import { ConcurrentUpdateError } from "../domain/ConcurrentUpdateError.js";
import { ConfirmationClosedError } from "../domain/ConfirmationClosedError.js";
import { NotFoundError } from "../domain/errors.js";
import type { Requester } from "../domain/letters/types.js";
import type { Report } from "../domain/Report.js";
import { ReportId } from "../domain/ReportId.js";
import type { ReportStatusView } from "../domain/ReportRecord.js";
import { isoSeconds } from "../domain/timeUtils.js";
import type { Clock } from "../ports/Clock.js";
import type { ReportQueue } from "../ports/ReportQueue.js";
import type { ReportRepository } from "../ports/ReportRepository.js";
import type { LetterRateLimiter } from "./letters/LetterRateLimiter.js";

const ATTEMPTS = 3;

export interface ReportConfirmerDeps {
  readonly reports: ReportRepository;
  readonly queue: ReportQueue;
  // Counts confirmations per user and per device, like the other writes.
  readonly limiter: LetterRateLimiter;
  readonly clock: Clock;
  readonly publicBaseUrl: string;
}

export interface ConfirmRequest {
  readonly reportId: string;
  readonly requester: Requester;
  readonly sure: boolean;
}

// POST /reports/{id}/confirm (contracts v1.16): the reporter's answer when the judge was unsure.
export class ReportConfirmer {
  readonly #deps: ReportConfirmerDeps;

  constructor(deps: ReportConfirmerDeps) {
    this.#deps = deps;
  }

  // The rate limit counts before the report is read, so probing other ids costs the same.
  async confirm(request: ConfirmRequest): Promise<ReportStatusView> {
    const now = this.#deps.clock.now();
    await this.#deps.limiter.take(request.requester, now);
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.#apply(request, isoSeconds(now));
      } catch (error) {
        // A concurrent answer saved first: read again, so a retry of the same answer still gets 200.
        if (!(error instanceof ConcurrentUpdateError) || attempt >= ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  async #apply(request: ConfirmRequest, now: string): Promise<ReportStatusView> {
    const report = await this.#load(request);
    const outcome = report.answerConfirmation(request.sure, now);
    if (outcome === "recorded" || outcome === "expired") {
      await this.#deps.reports.save(report);
    }
    if (outcome === "expired" || outcome === "closed") {
      throw new ConfirmationClosedError("This report is no longer waiting for your answer.");
    }
    // Sent again on a retry too, so a lost send never strands a confirmed report in processing.
    if (request.sure && report.status === "processing") {
      await this.#deps.queue.sendReport(report.id);
    }
    return report.statusView(this.#deps.publicBaseUrl);
  }

  async #load({ reportId, requester }: ConfirmRequest): Promise<Report> {
    const report = ReportId.isValid(reportId) ? await this.#deps.reports.get(reportId) : undefined;
    if (report === undefined || !report.isOwnedBy(requester)) {
      throw new NotFoundError("No report with that id for you");
    }
    return report;
  }
}
