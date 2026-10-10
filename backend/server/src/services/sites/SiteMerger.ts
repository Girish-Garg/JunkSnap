import { InternalDataError } from "../../domain/errors.js";
import { BoundingBox } from "../../domain/sites/BoundingBox.js";
import type { GeoPoint } from "../../domain/sites/GeoPoint.js";
import type { MergeableReport, MergeEvidence } from "../../domain/sites/MergeableReport.js";
import type { MergeableReportFactory } from "../../domain/sites/MergeableReportFactory.js";
import { MERGE_RADIUS_M, Site } from "../../domain/sites/Site.js";
import { StaleSiteError } from "../../domain/sites/SiteErrors.js";
import type { Verification } from "../../domain/sites/SiteTypes.js";
import { ZeroScoreRows } from "../../domain/sites/ZeroScoreRows.js";
import type { AreaScoreSeeder } from "../../ports/sites/AreaScoreSeeder.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { GeoCells } from "../../ports/sites/GeoCells.js";
import type { ReportStatusWriter } from "../../ports/sites/ReportStatusWriter.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { ConflictRetry } from "./ConflictRetry.js";
import type { MergeTargetPicker } from "./MergeTargetPicker.js";

export interface SiteMergerDeps {
  readonly sites: SiteRepository;
  readonly cells: GeoCells;
  readonly picker: MergeTargetPicker;
  readonly reports: ReportStatusWriter;
  readonly scores: AreaScoreSeeder;
  readonly clock: Clock;
  readonly reportFactory: MergeableReportFactory;
  readonly retry: ConflictRetry;
}

type Outcome = "founded" | "merged" | "unchanged";

export interface MergeResult {
  readonly siteId: string;
  readonly outcome: Outcome;
  // The worker writes this as the merged report's status, with siteId as its site_id.
  readonly reportStatus: Verification;
}

interface Merged {
  readonly site: Site;
  readonly outcome: Outcome;
}

// Merges a verified or community-check report into a site; idempotent per report id.
export class SiteMerger {
  readonly #deps: SiteMergerDeps;

  constructor(deps: SiteMergerDeps) {
    this.#deps = deps;
  }

  // Reports follow their site on every pass, so a redelivered message repairs a failed status write.
  async merge(evidence: MergeEvidence): Promise<MergeResult> {
    const report = this.#deps.reportFactory.create(evidence);
    const { site, outcome } = await this.#deps.retry.run(() => this.#attempt(report));
    await this.#deps.reports.followSite(site.reportIds, site.verification);
    return { siteId: site.siteId, outcome, reportStatus: site.verification };
  }

  async #attempt(report: MergeableReport): Promise<Merged> {
    const nearby = await this.#nearby(report.point);
    const holder = nearby.find((site) => site.holds(report.reportId));
    if (holder !== undefined) {
      return { site: holder, outcome: "unchanged" };
    }
    const target = await this.#deps.picker.pick(report, nearby);
    return target === null ? this.#found(report) : this.#mergeInto(target.siteId, report);
  }

  async #nearby(point: GeoPoint): Promise<Site[]> {
    const cells = this.#deps.cells.covering(BoundingBox.around(point, MERGE_RADIUS_M));
    const perCell = await Promise.all(cells.map((cell) => this.#deps.sites.inCell(cell)));
    return perCell.flat();
  }

  // Re-reads the target by id: the geohash index is eventually consistent.
  async #mergeInto(siteId: string, report: MergeableReport): Promise<Merged> {
    const site = await this.#deps.sites.get(siteId);
    if (site?.holds(report.reportId)) {
      return { site, outcome: "unchanged" };
    }
    if (!site?.accepts(report)) {
      throw new StaleSiteError(`${siteId} changed while merging ${report.reportId}`);
    }
    site.merge(report);
    await this.#deps.sites.save(site);
    return { site, outcome: "merged" };
  }

  // Seeds before creating, so a retry that finds the site already merged needs no seeding.
  async #found(report: MergeableReport): Promise<Merged> {
    const site = Site.found(report);
    const zero = new ZeroScoreRows(site.toFeature());
    const within = zero.within();
    await Promise.all(zero.rows(this.#deps.clock.now().toISOString()).map((row) => this.#deps.scores.seedIfMissing(row, within)));
    if (await this.#deps.sites.create(site)) {
      return { site, outcome: "founded" };
    }
    const existing = await this.#deps.sites.get(site.siteId);
    if (existing?.holds(report.reportId)) {
      return { site: existing, outcome: "unchanged" };
    }
    throw new InternalDataError(`${site.siteId} exists without its founding report ${report.reportId}`);
  }
}
