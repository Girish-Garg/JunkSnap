import type { GeoPoint } from "../../domain/sites/GeoPoint.js";
import type { Site } from "../../domain/sites/Site.js";
import { SiteNotFoundError } from "../../domain/sites/SiteErrors.js";
import type { Voter, VoteChoice, VoteResult } from "../../domain/sites/SiteTypes.js";
import { VoteTally } from "../../domain/sites/VoteTally.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { ReportStatusWriter } from "../../ports/sites/ReportStatusWriter.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { VoteRepository } from "../../ports/sites/VoteRepository.js";
import type { ConflictRetry } from "./ConflictRetry.js";

// userId comes from the verified sign-in token, never from the body.
export interface Ballot extends Voter {
  readonly choice: VoteChoice;
  readonly point: GeoPoint;
}

export interface VoteServiceDeps {
  readonly sites: SiteRepository;
  readonly votes: VoteRepository;
  readonly reports: ReportStatusWriter;
  readonly clock: Clock;
  readonly retry: ConflictRetry;
}

// Records a neighbour's yes or no and recounts the site's backers (decision 20261010-1530).
export class VoteService {
  readonly #deps: VoteServiceDeps;

  constructor(deps: VoteServiceDeps) {
    this.#deps = deps;
  }

  // Reports follow their site on every vote, so a failed status write heals on the next one.
  async cast(siteId: string, ballot: Ballot): Promise<VoteResult> {
    const site = await this.#load(siteId);
    site.admitVoter(ballot, ballot.point);
    await this.#deps.votes.put({
      siteId,
      deviceToken: ballot.deviceToken,
      userId: ballot.userId,
      choice: ballot.choice,
      votedAt: this.#deps.clock.now().toISOString(),
    });
    const settled = await this.#deps.retry.run(() => this.#settle(siteId));
    await this.#deps.reports.followSite(settled.reportIds, settled.verification);
    return settled.voteResult();
  }

  // Re-reads every vote, so concurrent voters converge on the same count.
  async #settle(siteId: string): Promise<Site> {
    const site = await this.#load(siteId);
    site.recordVotes(VoteTally.of(await this.#deps.votes.forSite(siteId)));
    await this.#deps.sites.save(site);
    return site;
  }

  async #load(siteId: string): Promise<Site> {
    const site = await this.#deps.sites.get(siteId);
    if (site === null) {
      throw new SiteNotFoundError(`No site ${siteId}`);
    }
    return site;
  }
}
