import { InternalDataError } from "../../domain/errors.js";
import { BoundingBox } from "../../domain/sites/BoundingBox.js";
import type { GeoPoint } from "../../domain/sites/GeoPoint.js";
import type { MergeableReport, MergeEvidence } from "../../domain/sites/MergeableReport.js";
import type { MergeableReportFactory } from "../../domain/sites/MergeableReportFactory.js";
import { mergeRadiusM } from "../../domain/sites/NoBinZone.js";
import { Site } from "../../domain/sites/Site.js";
import type { SiteRules } from "../../domain/sites/SiteRules.js";
import { StaleSiteError } from "../../domain/sites/SiteErrors.js";
import { VoteTally } from "../../domain/sites/VoteTally.js";
import type { Verification } from "../../domain/sites/SiteTypes.js";
import { ZeroScoreRows } from "../../domain/sites/ZeroScoreRows.js";
import type { AreaScoreSeeder } from "../../ports/sites/AreaScoreSeeder.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { GeoCells } from "../../ports/sites/GeoCells.js";
import type { ReportStatusWriter } from "../../ports/sites/ReportStatusWriter.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { VoteRepository } from "../../ports/sites/VoteRepository.js";
import type { ConflictRetry } from "./ConflictRetry.js";
import type { MergeTargetPicker } from "./MergeTargetPicker.js";

export interface SiteMergerDeps {
  readonly sites: SiteRepository;
  // Cleared votes are recounted against the newest report (decision 20261010-1855).
  readonly votes: VoteRepository;
  readonly cells: GeoCells;
  readonly picker: MergeTargetPicker;
  readonly reports: ReportStatusWriter;
  readonly scores: AreaScoreSeeder;
  readonly clock: Clock;
  readonly reportFactory: MergeableReportFactory;
  readonly retry: ConflictRetry;
  readonly rules: SiteRules;
  // MIN_VERIFIED_REPORTS, written on the zero-count rows of a new site's areas.
  readonly minVerifiedReports: number;
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

  // The holder check runs first: a redelivered scan frame that joined a neighbour site must not join its spot's site too.
  // The picker then puts a same-type site at the same spot ahead of the spot's site (decision 20261011-1610).
  async #attempt(report: MergeableReport): Promise<Merged> {
    const nearby = await this.#candidates(report);
    const holder = nearby.find((site) => site.holds(report.reportId));
    if (holder !== undefined) {
      return { site: holder, outcome: "unchanged" };
    }
    const target = await this.#deps.picker.pick(report, nearby);
    return target === null ? this.#found(report) : this.#mergeInto(target.siteId, report);
  }

  // The sites in the merge radius, and a scan frame's spot site read by id: the geohash index may not show a site
  // another frame of the scan founded a moment ago.
  async #candidates(report: MergeableReport): Promise<Site[]> {
    const radius = mergeRadiusM(report.reportType, this.#deps.rules);
    const [nearby, spotSite] = await Promise.all([this.#nearby(report.point, radius), this.#spotSite(report)]);
    return spotSite === null ? nearby : [spotSite, ...nearby.filter((site) => site.siteId !== spotSite.siteId)];
  }

  async #spotSite(report: MergeableReport): Promise<Site | null> {
    return report.spotSiteId === undefined ? null : this.#deps.sites.get(report.spotSiteId);
  }

  async #nearby(point: GeoPoint, radius: number): Promise<Site[]> {
    const cells = this.#deps.cells.covering(BoundingBox.around(point, radius));
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
    site.recordVotes(VoteTally.of(await this.#deps.votes.forSite(siteId)));
    await this.#deps.sites.save(site);
    return { site, outcome: "merged" };
  }

  // Seeds before creating, so a retry that finds the site already merged needs no seeding.
  async #found(report: MergeableReport): Promise<Merged> {
    const site = Site.found(report, this.#deps.rules);
    const zero = new ZeroScoreRows(site.toFeature(), this.#deps.minVerifiedReports);
    const within = zero.within();
    await Promise.all(zero.rows(this.#deps.clock.now().toISOString()).map((row) => this.#deps.scores.seedIfMissing(row, within)));
    if (await this.#deps.sites.create(site)) {
      return { site, outcome: "founded" };
    }
    const existing = await this.#deps.sites.get(site.siteId);
    if (existing?.holds(report.reportId)) {
      return { site: existing, outcome: "unchanged" };
    }
    // Another frame of the same scan spot founded it first.
    if (existing?.accepts(report)) {
      return this.#mergeInto(existing.siteId, report);
    }
    // The spot's site was hidden by neighbours since: the frame founds a site of its own, as a photo would.
    if (report.spotSiteId !== undefined) {
      return this.#found({ ...report, spotSiteId: undefined });
    }
    throw new InternalDataError(`${site.siteId} exists without its founding report ${report.reportId}`);
  }
}
