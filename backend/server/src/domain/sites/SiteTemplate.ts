import { BACKERS_NEEDED } from "./Backers.js";
import { InsightMerge } from "./InsightMerge.js";
import { ZONE_RADIUS_M } from "./NoBinZone.js";
import type { MergeableReport } from "./MergeableReport.js";
import type { SiteFeature, SiteInternals, SiteProperties } from "./SiteTypes.js";

const REPORT_PREFIX = "rpt_";

// An empty site at the founding report's place; Site.found then merges the report into it.
export class SiteTemplate {
  readonly #report: MergeableReport;

  constructor(report: MergeableReport) {
    this.#report = report;
  }

  // The site id reuses the founding report's suffix, so a retried merge finds the same id.
  feature(): SiteFeature {
    const report = this.#report;
    const properties: SiteProperties = {
      site_id: `site_${report.reportId.slice(REPORT_PREFIX.length)}`,
      report_type: report.reportType,
      context: report.context,
      status: "open",
      verification: "unverified",
      report_count: 0,
      verified_count: 0,
      corroborations: 0,
      backers: { count: 0, needed: BACKERS_NEEDED, photo_people: 0, vote_people: 0 },
      votes: { confirm: 0, reject: 0 },
      photo_urls: [],
      cleanup_status: "none",
      cleanup_photo_url: null,
      burning: false,
      location: report.location,
      brands: [],
      first_reported_at: report.reportedAt,
      last_reported_at: report.reportedAt,
      cleaned_at: null,
      pilot: report.pilot,
      reporters: 1,
      insights: new InsightMerge([]).merged([...report.near], report.bin),
      ...(report.reportType === "no_bin" ? { zone_radius_m: ZONE_RADIUS_M } : {}),
    };
    return { type: "Feature", geometry: { type: "Point", coordinates: report.point.coordinates() }, properties };
  }

  internals(): SiteInternals {
    return {
      reports: [],
      reporterDevices: [],
      reporterUsers: [],
      reporterIds: [],
      yesVoters: [],
      noVoters: [],
      needsBackerCount: false,
      verifiedBackers: null,
      meTooCount: 0,
      embeddingKey: null,
      pendingCleanupId: null,
      withdrawnReports: [],
      version: 0,
    };
  }
}
