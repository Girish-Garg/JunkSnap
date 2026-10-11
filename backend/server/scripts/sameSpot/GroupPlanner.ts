import { JunkSnapError } from "../../src/domain/errors.js";
import type { MergeableReport } from "../../src/domain/sites/MergeableReport.js";
import type { Site } from "../../src/domain/sites/Site.js";
import type { NoteStore } from "../../src/ports/notes/NoteStore.js";
import type { ReportRepository } from "../../src/ports/ReportRepository.js";
import type { SiteRepository } from "../../src/ports/sites/SiteRepository.js";
import type { SameSpotGroup } from "./SameSpotGrouper.js";
import type { StoredReportEvidence } from "./StoredReportEvidence.js";

export interface AbsorbPlan {
  readonly site: Site;
  readonly reports: readonly MergeableReport[];
}

export interface GroupPlan {
  readonly keep: Site;
  readonly absorb: readonly AbsorbPlan[];
}

export type Planned = { readonly plan: GroupPlan } | { readonly skip: string };

export interface PlannerDeps {
  readonly sites: SiteRepository;
  readonly reports: ReportRepository;
  readonly notes: Pick<NoteStore, "shownFor">;
  readonly evidence: StoredReportEvidence;
}

// Why one absorbed site cannot move as it is; the whole group then stays for a person to merge by hand.
class Unsafe extends Error {}

// Reads a group afresh and checks that every absorbed site can move into the kept one without losing anything.
export class GroupPlanner {
  readonly #deps: PlannerDeps;

  constructor(deps: PlannerDeps) {
    this.#deps = deps;
  }

  async plan(group: SameSpotGroup): Promise<Planned> {
    const keep = await this.#deps.sites.get(group.keep.siteId);
    if (keep === null || !keep.isListed()) {
      return { skip: `${group.keep.siteId} is no longer open` };
    }
    try {
      const absorb: AbsorbPlan[] = [];
      for (const { site } of group.absorb) {
        absorb.push(await this.#absorb(keep, site.siteId));
      }
      return { plan: { keep, absorb } };
    } catch (error) {
      if (error instanceof Unsafe || error instanceof JunkSnapError) {
        return { skip: error.message };
      }
      throw error;
    }
  }

  async #absorb(keep: Site, siteId: string): Promise<AbsorbPlan> {
    const site = await this.#deps.sites.get(siteId);
    if (site === null) {
      throw new Unsafe(`${siteId} is gone`);
    }
    await this.#checkMovable(site);
    const reports = await Promise.all(site.reportIds.map((reportId) => this.#mergeable(reportId, site.siteId, keep)));
    const stored = site.snapshot().feature.properties.photo_urls;
    const computed = new Set(reports.flatMap((report) => report.photoUrl ?? []));
    if (stored.length > 0 && !stored.some((url) => computed.has(url))) {
      throw new Unsafe(`${siteId}: its photo URLs do not start with PUBLIC_BASE_URL`);
    }
    return { site, reports };
  }

  // Photo reports, residents' notes and cleanups live in their own rows: these sites are merged by hand.
  async #checkMovable(site: Site): Promise<void> {
    const reason = GroupPlanner.#blocker(site) ?? ((await this.#deps.notes.shownFor(site.siteId)).length > 0 ? "has residents' notes" : null);
    if (reason !== null) {
      throw new Unsafe(`${site.siteId} ${reason}`);
    }
  }

  static #blocker(site: Site): string | null {
    const { feature, internals } = site.snapshot();
    const properties = feature.properties;
    const checks: readonly (readonly [boolean, string])[] = [
      [!site.isListed(), "is no longer open"],
      [(properties.photo_flags ?? []).length > 0, "has photo reports"],
      [properties.cleanup_status !== "none" || properties.clearance !== undefined, "has a cleanup or cleared words"],
      [internals.pendingCleanupId !== null || internals.cleanupPeople.length > 0, "has a cleanup or cleared words"],
    ];
    return checks.find(([blocked]) => blocked)?.[1] ?? null;
  }

  async #mergeable(reportId: string, absorbedId: string, keep: Site): Promise<MergeableReport> {
    const row = (await this.#deps.reports.get(reportId))?.toRecord();
    if (row === undefined) {
      throw new Unsafe(`report ${reportId} of ${absorbedId} has no row`);
    }
    if (row.site_id !== absorbedId && row.site_id !== keep.siteId) {
      throw new Unsafe(`report ${reportId} of ${absorbedId} belongs to ${row.site_id ?? "no site"}`);
    }
    const report = this.#deps.evidence.mergeable(row, absorbedId, keep.siteId);
    if (!keep.holds(reportId) && !keep.accepts(report)) {
      const metres = Math.round(keep.point.distanceTo(report.point));
      throw new Unsafe(`report ${reportId} of ${absorbedId} is ${metres} m from ${keep.siteId}, which does not accept it`);
    }
    return report;
  }
}
