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
import { ConflictRetry } from "./ConflictRetry.js";
import type { MergeTargetPicker } from "./MergeTargetPicker.js";

export interface SiteMergerDeps {
  readonly sites: SiteRepository;
  readonly cells: GeoCells;
  readonly picker: MergeTargetPicker;
  readonly reports: ReportStatusWriter;
  readonly scores: AreaScoreSeeder;
  readonly clock: Clock;
  readonly reportFactory: MergeableReportFactory;
}

export interface MergeResult {
  readonly siteId: string;
  readonly outcome: "founded" | "merged" | "unchanged";
  // The worker writes this as the merged report's status, with siteId as its site_id.
  readonly reportStatus: Verification;
}

// Merges a verified or community-check report into a site; idempotent per report id.
export class SiteMerger {
  readonly #deps: SiteMergerDeps;
  readonly #retry = new ConflictRetry();

  constructor(deps: SiteMergerDeps) {
    this.#deps = deps;
  }

  async merge(evidence: MergeEvidence): Promise<MergeResult> {
    const report = this.#deps.reportFactory.create(evidence);
    return this.#retry.run(() => this.#attempt(report));
  }

  async #attempt(report: MergeableReport): Promise<MergeResult> {
    const nearby = await this.#nearby(report.point);
    const holder = nearby.find((site) => site.holds(report.reportId));
    if (holder !== undefined) {
      return SiteMerger.#result(holder, "unchanged");
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
  async #mergeInto(siteId: string, report: MergeableReport): Promise<MergeResult> {
    const site = await this.#deps.sites.get(siteId);
    if (site?.holds(report.reportId)) {
      return SiteMerger.#result(site, "unchanged");
    }
    if (!site?.accepts(report)) {
      throw new StaleSiteError(`${siteId} changed while merging ${report.reportId}`);
    }
    const before = site.verification;
    site.merge(report);
    await this.#deps.sites.save(site);
    if (site.verification !== before) {
      await this.#deps.reports.followSite(site.reportIds, site.verification);
    }
    return SiteMerger.#result(site, "merged");
  }

  // Seeds before creating, so a retry that finds the site already merged needs no seeding.
  async #found(report: MergeableReport): Promise<MergeResult> {
    const site = Site.found(report);
    const rows = new ZeroScoreRows(site.toFeature()).rows(this.#deps.clock.now().toISOString());
    await Promise.all(rows.map((row) => this.#deps.scores.seedIfMissing(row)));
    if (await this.#deps.sites.create(site)) {
      return SiteMerger.#result(site, "founded");
    }
    const existing = await this.#deps.sites.get(site.siteId);
    if (existing?.holds(report.reportId)) {
      return SiteMerger.#result(existing, "unchanged");
    }
    throw new InternalDataError(`${site.siteId} exists without its founding report ${report.reportId}`);
  }

  static #result(site: Site, outcome: MergeResult["outcome"]): MergeResult {
    return { siteId: site.siteId, outcome, reportStatus: site.verification };
  }
}
