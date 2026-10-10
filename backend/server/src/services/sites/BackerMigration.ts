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
  readonly verified: number;
  readonly rejected: number;
}

// One-off move to decision 20261010-1530: recounts every site's backers from its stored photos and votes.
export class BackerMigration {
  readonly #deps: BackerMigrationDeps;

  constructor(deps: BackerMigrationDeps) {
    this.#deps = deps;
  }

  // Safe to run twice: the same photos and votes give the same answer.
  async run(): Promise<MigrationSummary> {
    const migrated: Site[] = [];
    for (const siteId of await this.#deps.sites.allIds()) {
      migrated.push(await this.migrate(siteId));
    }
    const count = (verification: string) => migrated.filter((site) => site.verification === verification).length;
    return { sites: migrated.length, verified: count("verified"), rejected: count("rejected") };
  }

  async migrate(siteId: string): Promise<Site> {
    const site = await this.#deps.retry.run(async () => {
      const stored = await this.#deps.sites.get(siteId);
      if (stored === null) {
        throw new SiteNotFoundError(`site ${siteId} vanished during the migration`);
      }
      stored.rebuild(VoteTally.of(await this.#deps.votes.forSite(siteId)));
      await this.#deps.sites.save(stored);
      return stored;
    });
    await this.#deps.reports.followSite(site.reportIds, site.verification);
    return site;
  }
}
