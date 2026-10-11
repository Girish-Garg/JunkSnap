import { InternalDataError } from "../../src/domain/errors.js";
import type { MergeableReport } from "../../src/domain/sites/MergeableReport.js";
import { MergedRemoval } from "../../src/domain/sites/MergedRemoval.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { SiteRules } from "../../src/domain/sites/SiteRules.js";
import { VoteTally } from "../../src/domain/sites/VoteTally.js";
import type { ReportRepository } from "../../src/ports/ReportRepository.js";
import type { Clock } from "../../src/ports/sites/Clock.js";
import type { ReportStatusWriter } from "../../src/ports/sites/ReportStatusWriter.js";
import type { SiteRepository } from "../../src/ports/sites/SiteRepository.js";
import type { VoteRepository } from "../../src/ports/sites/VoteRepository.js";
import type { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import type { GroupPlan } from "./GroupPlanner.js";
import { propertiesOf } from "./SameSpotGrouper.js";

export interface GroupMergerDeps {
  readonly sites: SiteRepository;
  readonly reports: ReportRepository;
  readonly statuses: ReportStatusWriter;
  readonly votes: VoteRepository;
  readonly retry: ConflictRetry;
  readonly rules: SiteRules;
  readonly clock: Clock;
  readonly print: (line: string) => void;
}

// Applies one checked group with the live domain (decision 20261011-1730-hem-merged-sites), in an order a rerun repairs:
// votes first, then the kept site (Site.merge as SiteMerger does, saved on its version), the report rows, and last the
// absorbed sites. Every step skips what is already done, so a second run writes nothing new.
export class GroupMerger {
  readonly #deps: GroupMergerDeps;

  constructor(deps: GroupMergerDeps) {
    this.#deps = deps;
  }

  // False when an absorbed site took a new report during the run and stays open for the next run.
  async apply(plan: GroupPlan): Promise<boolean> {
    const keptId = plan.keep.siteId;
    for (const { site } of plan.absorb) {
      await this.#copyVotes(site.siteId, keptId);
    }
    const reports = plan.absorb.flatMap((absorb) => absorb.reports);
    const kept = await this.#deps.retry.run(() => this.#mergeReports(keptId, reports));
    await this.#moveRows(kept, reports);
    await this.#deps.statuses.followSite(kept.reportIds, kept.verification);
    const moved = new Set(reports.map((report) => report.reportId));
    let retired = true;
    for (const { site } of plan.absorb) {
      retired = (await this.#deps.retry.run(() => this.#retire(site.siteId, keptId, moved))) && retired;
    }
    await this.#recount(keptId);
    return retired;
  }

  // Votes key on (site_id, device_token): a device keeps its newer vote; nothing is deleted.
  async #copyVotes(fromId: string, toId: string): Promise<void> {
    const { votes, print } = this.#deps;
    const [from, to] = await Promise.all([votes.forSite(fromId), votes.forSite(toId)]);
    const kept = new Map(to.map((vote) => [vote.deviceToken, Date.parse(vote.votedAt)]));
    const newer = from.filter((vote) => Date.parse(vote.votedAt) > (kept.get(vote.deviceToken) ?? Number.NEGATIVE_INFINITY));
    await Promise.all(newer.map((vote) => votes.put({ ...vote, siteId: toId })));
    print(`${fromId}: copied ${newer.length} of ${from.length} votes to ${toId}`);
  }

  async #mergeReports(keptId: string, reports: readonly MergeableReport[]): Promise<Site> {
    const kept = await this.#read(keptId);
    const before = GroupMerger.#counts(kept);
    const fresh = reports.filter((report) => !kept.holds(report.reportId));
    fresh.forEach((report) => kept.merge(report));
    kept.recordVotes(VoteTally.of(await this.#deps.votes.forSite(keptId)));
    await this.#deps.sites.save(kept);
    this.#deps.print(`${keptId}: merged ${fresh.length} reports (${reports.length - fresh.length} already there); ${before} -> ${GroupMerger.#counts(kept)}`);
    return kept;
  }

  // Each moved report row points at the kept site and takes its status; a row already there is left alone.
  async #moveRows(kept: Site, reports: readonly MergeableReport[]): Promise<void> {
    for (const { reportId } of reports) {
      const report = await this.#deps.reports.get(reportId);
      const from = report?.toRecord().site_id;
      if (report === undefined || from === kept.siteId) {
        continue;
      }
      report.recordSite({ siteId: kept.siteId, verification: kept.verification });
      await this.#deps.reports.save(report);
      this.#deps.print(`report ${reportId}: site_id ${from ?? "none"} -> ${kept.siteId}, status ${kept.verification}`);
    }
  }

  // The worker and the api keep running. Votes cast on the duplicate since they were copied are copied again; a report
  // merged into it since the plan leaves it open, so the next run moves that report too. The save is on the duplicate's
  // version, so a report or vote saved on it after this read retries the whole step.
  async #retire(siteId: string, keptId: string, moved: ReadonlySet<string>): Promise<boolean> {
    const site = await this.#read(siteId);
    await this.#copyVotes(siteId, keptId);
    const late = site.reportIds.filter((reportId) => !moved.has(reportId));
    if (late.length > 0) {
      this.#deps.print(`${siteId}: left open: it took ${late.join(", ")} during this run; run again to move ${late.length === 1 ? "it" : "them"}`);
      return false;
    }
    const state = site.snapshot();
    const removed = new MergedRemoval(state).into(keptId, this.#deps.clock.now().toISOString());
    if (removed === state) {
      this.#deps.print(`${siteId}: already merged into ${keptId}`);
      return true;
    }
    await this.#deps.sites.save(Site.restore(removed, this.#deps.rules));
    this.#deps.print(`${siteId}: removed, removed_reason merged, merged_into ${keptId}`);
    return true;
  }

  // Counts the votes copied while retiring; saved and printed only when they change the kept site.
  async #recount(keptId: string): Promise<void> {
    const kept = await this.#deps.retry.run(async () => {
      const site = await this.#read(keptId);
      const before = JSON.stringify(site.snapshot());
      site.recordVotes(VoteTally.of(await this.#deps.votes.forSite(keptId)));
      if (JSON.stringify(site.snapshot()) !== before) {
        await this.#deps.sites.save(site);
        this.#deps.print(`${keptId}: recounted the votes copied at the end; ${GroupMerger.#counts(site)}`);
      }
      return site;
    });
    await this.#deps.statuses.followSite(kept.reportIds, kept.verification);
  }

  async #read(siteId: string): Promise<Site> {
    const site = await this.#deps.sites.get(siteId);
    if (site === null) {
      throw new InternalDataError(`${siteId} vanished while merging`);
    }
    return site;
  }

  static #counts(site: Site): string {
    const { report_count, backers, verification, corroborations } = propertiesOf(site);
    return `${report_count} reports, ${backers.count} of ${backers.needed} backers, ${corroborations} corroborations, ${verification}`;
  }
}
