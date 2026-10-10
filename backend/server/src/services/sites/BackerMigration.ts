import type { Site } from "../../domain/sites/Site.js";
import { SiteNotFoundError } from "../../domain/sites/SiteErrors.js";
import { VoteTally } from "../../domain/sites/VoteTally.js";
import type { ReportStatusWriter } from "../../ports/sites/ReportStatusWriter.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { VoteRepository } from "../../ports/sites/VoteRepository.js";
import type { ConflictRetry } from "./ConflictRetry.js";

export interface BackerMigrationDeps {
  readonly sites: SiteRepository;
  readonly votes: VoteRepository;
  readonly reports: ReportStatusWriter;
  readonly retry: ConflictRetry;
}

export interface MigrationSummary {
  readonly sites: number;
  readonly migrated: number;
  readonly skipped: number;
  readonly verified: number;
  readonly rejected: number;
}

// One-off move to decision 20261010-1530: recounts the backers of rows written before it.
export class BackerMigration {
  readonly #deps: BackerMigrationDeps;

  constructor(deps: BackerMigrationDeps) {
    this.#deps = deps;
  }

  // Safe to rerun: a site that already has backers is never touched, so no rerun can demote or un-reject it.
  async run(): Promise<MigrationSummary> {
    const migrated: Site[] = [];
    let sites = 0;
    for (const siteId of await this.#deps.sites.allIds()) {
      sites += 1;
      const site = await this.migrate(siteId);
      if (site !== null) {
        migrated.push(site);
      }
    }
    const count = (verification: string) => migrated.filter((site) => site.verification === verification).length;
    const summary = { sites, migrated: migrated.length, skipped: sites - migrated.length };
    return { ...summary, verified: count("verified"), rejected: count("rejected") };
  }

  // Null when the site already counts its backers.
  async migrate(siteId: string): Promise<Site | null> {
    const site = await this.#deps.retry.run(async () => {
      const stored = await this.#deps.sites.get(siteId);
      if (stored === null) {
        throw new SiteNotFoundError(`site ${siteId} vanished during the migration`);
      }
      if (!stored.needsBackerCount) {
        return null;
      }
      stored.rebuild(VoteTally.of(await this.#deps.votes.forSite(siteId)));
      await this.#deps.sites.save(stored);
      return stored;
    });
    if (site !== null) {
      await this.#deps.reports.followSite(site.reportIds, site.verification);
    }
    return site;
  }
}
