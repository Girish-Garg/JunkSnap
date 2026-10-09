import type { Verification } from "../../domain/sites/SiteTypes.js";

export interface ReportStatusWriter {
  // A merged report's status follows its site's verification.
  followSite(reportIds: readonly string[], status: Verification): Promise<void>;
}
