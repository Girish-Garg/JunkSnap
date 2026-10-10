import { ConcurrentUpdateError } from "../domain/ConcurrentUpdateError.js";
import { NotFoundError } from "../domain/errors.js";
import type { Report } from "../domain/Report.js";
import { ReportId } from "../domain/ReportId.js";
import type { ReportStatusView, Viewer } from "../domain/ReportRecord.js";
import { isoSeconds } from "../domain/timeUtils.js";
import type { Clock } from "../ports/Clock.js";
import type { ReportRepository } from "../ports/ReportRepository.js";

// GET /reports/{id}: a malformed id and anyone but the owner all look like a missing report.
export class ReportStatusReader {
  readonly #reports: ReportRepository;
  readonly #publicBaseUrl: string;
  readonly #clock: Clock;

  constructor(reports: ReportRepository, publicBaseUrl: string, clock: Clock) {
    this.#reports = reports;
    this.#publicBaseUrl = publicBaseUrl;
    this.#clock = clock;
  }

  async read(reportId: string, viewer: Viewer): Promise<ReportStatusView> {
    const report = ReportId.isValid(reportId) ? await this.#reports.get(reportId) : undefined;
    if (report === undefined || !report.isOwnedBy(viewer)) {
      throw new NotFoundError("No report with that id for you");
    }
    if (report.expireConfirmation(isoSeconds(this.#clock.now()))) {
      await this.#writeExpiry(report);
    }
    return report.statusView(this.#publicBaseUrl);
  }

  // Contracts v1.16: the api writes not_confirmed when it next reads the report; a lost race leaves it to the next read.
  async #writeExpiry(report: Report): Promise<void> {
    try {
      await this.#reports.save(report);
    } catch (error) {
      if (!(error instanceof ConcurrentUpdateError)) {
        throw error;
      }
    }
  }
}
