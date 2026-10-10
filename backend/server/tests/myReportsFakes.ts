import { Report } from "../src/domain/Report.js";
import type { Clock } from "../src/ports/Clock.js";
import type { UserReportLister, UserReportPage, UserReportPageRequest } from "../src/ports/UserReportLister.js";
import { MyReportsQuery } from "../src/services/MyReportsQuery.js";
import { FixedClock, type FakeReportRepository } from "./reportFakes.js";

// Lists the fake repository's rows the way DynamoUserReportLister queries by-user: snaps only, newest first.
export class FakeUserReportLister implements UserReportLister {
  readonly #reports: FakeReportRepository;

  constructor(reports: FakeReportRepository) {
    this.#reports = reports;
  }

  async page(userId: string, request: UserReportPageRequest): Promise<UserReportPage> {
    const rows = [...this.#reports.records.values()]
      .filter((record) => record.user_id === userId && record.capture_mode === "snap")
      .sort((a, b) => b.received_at.localeCompare(a.received_at) || b.report_id.localeCompare(a.report_id));
    const start = request.cursor === null ? 0 : Number(request.cursor);
    const slice = rows.slice(start, start + request.limit);
    const end = start + slice.length;
    return { reports: slice.map((record) => Report.fromRecord(record)), nextCursor: end < rows.length ? String(end) : null };
  }
}

export function fakeMine(
  reports: FakeReportRepository,
  publicBaseUrl: string,
  clock: Clock = new FixedClock("2026-10-10T02:14:52Z"),
): MyReportsQuery {
  return new MyReportsQuery(new FakeUserReportLister(reports), publicBaseUrl, clock);
}
