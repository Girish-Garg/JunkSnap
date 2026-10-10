import type { ReportStatusView } from "../domain/ReportRecord.js";
import type { UserReportLister, UserReportPageRequest } from "../ports/UserReportLister.js";

export interface MyReportsPage {
  readonly reports: readonly ReportStatusView[];
  readonly next_cursor: string | null;
}

// GET /me/reports: the signed-in user's own Snap reports as GET /reports/{id} shows each one, newest first.
export class MyReportsQuery {
  readonly #lister: UserReportLister;
  readonly #publicBaseUrl: string;

  constructor(lister: UserReportLister, publicBaseUrl: string) {
    this.#lister = lister;
    this.#publicBaseUrl = publicBaseUrl;
  }

  async list(userId: string, request: UserReportPageRequest): Promise<MyReportsPage> {
    const page = await this.#lister.page(userId, request);
    // The same owner check as GET /reports/{id}, so a row that is not this user's never leaves the api.
    const mine = page.reports.filter((report) => report.isOwnedBy({ userId }));
    return { reports: mine.map((report) => report.statusView(this.#publicBaseUrl)), next_cursor: page.nextCursor };
  }
}
