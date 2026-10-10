import type { SiteBrand, SiteProperties, Verification } from "./SiteTypes.js";

// One report row on a site, as the reports table's by-site index holds it.
export interface SiteReportRef {
  readonly reportId: string;
  readonly userId: string | null;
  readonly deviceToken: string;
  readonly reportedAt: string;
  readonly brands: readonly SiteBrand[];
  // The blurred public copy's URL; null for a no_bin report without a photo.
  readonly photoUrl: string | null;
}

// Decision 20261010-1700: the caller's reports leave the site; the other people's reports stay.
export interface Withdrawal {
  readonly mine: readonly SiteReportRef[];
  readonly others: readonly SiteReportRef[];
  readonly at: string;
}

// The answer to DELETE /sites/{id}/reports/mine (contracts/README.md).
export interface WithdrawalResult {
  readonly site_id: string;
  readonly withdrawn_report_ids: readonly string[];
  readonly site_removed: boolean;
  readonly status: SiteProperties["status"];
  readonly verification: Verification;
  readonly backers: SiteProperties["backers"];
}
