import type { Report } from "../domain/Report.js";

export interface ReportRepository {
  get(reportId: string): Promise<Report | undefined>;
  // False when a report with this id already exists.
  create(report: Report): Promise<boolean>;
  save(report: Report): Promise<void>;
}
