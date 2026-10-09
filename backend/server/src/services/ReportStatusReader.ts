import { NotFoundError } from "../domain/errors.js";
import { ReportId } from "../domain/ReportId.js";
import type { ReportStatusView, Viewer } from "../domain/ReportRecord.js";
import type { ReportRepository } from "../ports/ReportRepository.js";

// GET /reports/{id}: a malformed id and anyone but the owner all look like a missing report.
export class ReportStatusReader {
  readonly #reports: ReportRepository;
  readonly #publicBaseUrl: string;

  constructor(reports: ReportRepository, publicBaseUrl: string) {
    this.#reports = reports;
    this.#publicBaseUrl = publicBaseUrl;
  }

  async read(reportId: string, viewer: Viewer): Promise<ReportStatusView> {
    const report = ReportId.isValid(reportId) ? await this.#reports.get(reportId) : undefined;
    if (report === undefined || !report.isOwnedBy(viewer)) {
      throw new NotFoundError("No report with that id for you");
    }
    return report.statusView(this.#publicBaseUrl);
  }
}
