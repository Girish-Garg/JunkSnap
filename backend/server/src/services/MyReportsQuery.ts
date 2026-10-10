import type { ReportStatusView } from "../domain/ReportRecord.js";
import { isoSeconds } from "../domain/timeUtils.js";
import type { Clock } from "../ports/Clock.js";
import type { UserReportLister, UserReportPageRequest } from "../ports/UserReportLister.js";

export interface MyReportsPage {
  readonly reports: readonly ReportStatusView[];
  readonly next_cursor: string | null;
}

// GET /me/reports: the signed-in user's own Snap reports as GET /reports/{id} shows each one, newest first.
export class MyReportsQuery {
  readonly #lister: UserReportLister;
  readonly #publicBaseUrl: string;
  readonly #clock: Clock;

  constructor(lister: UserReportLister, publicBaseUrl: string, clock: Clock) {
    this.#lister = lister;
    this.#publicBaseUrl = publicBaseUrl;
    this.#clock = clock;
  }

  async list(userId: string, request: UserReportPageRequest): Promise<MyReportsPage> {
    const page = await this.#lister.page(userId, request);
    const now = isoSeconds(this.#clock.now());
    // The same owner check as GET /reports/{id}, so a row that is not this user's never leaves the api.
    const mine = page.reports.filter((report) => report.isOwnedBy({ userId }));
    // A needs_confirmation report past its window reads as not_confirmed (contracts v1.16); GET /reports/{id} writes it.
    mine.forEach((report) => report.expireConfirmation(now));
    return { reports: mine.map((report) => report.statusView(this.#publicBaseUrl)), next_cursor: page.nextCursor };
  }
}
