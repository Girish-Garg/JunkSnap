import type { GeoPoint } from "../../domain/sites/GeoPoint.js";
import type { Site } from "../../domain/sites/Site.js";
import { SiteNotFoundError } from "../../domain/sites/SiteErrors.js";
import type { VoteChoice, VoteResult } from "../../domain/sites/SiteTypes.js";
import { VoteTally } from "../../domain/sites/VoteTally.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { DeviceReputation } from "../../ports/sites/DeviceReputation.js";
import type { ReportStatusWriter } from "../../ports/sites/ReportStatusWriter.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { VoteRepository } from "../../ports/sites/VoteRepository.js";
import { ConflictRetry } from "./ConflictRetry.js";

export interface Ballot {
  readonly deviceToken: string;
  readonly choice: VoteChoice;
  readonly point: GeoPoint;
}

export interface VoteServiceDeps {
  readonly sites: SiteRepository;
  readonly votes: VoteRepository;
  readonly devices: DeviceReputation;
  readonly reports: ReportStatusWriter;
  readonly clock: Clock;
}

// Records a neighbour's vote and settles the community check (contracts/README.md).
export class VoteService {
  readonly #deps: VoteServiceDeps;
  readonly #retry = new ConflictRetry();

  constructor(deps: VoteServiceDeps) {
    this.#deps = deps;
  }

  async cast(siteId: string, ballot: Ballot): Promise<VoteResult> {
    const site = await this.#load(siteId);
    site.admitVoter(ballot.deviceToken, ballot.point);
    const reputation = await this.#deps.devices.reputationOf(ballot.deviceToken);
    await this.#deps.votes.put({
      siteId,
      deviceToken: ballot.deviceToken,
      choice: ballot.choice,
      weight: VoteTally.weightFor(reputation),
      votedAt: this.#deps.clock.now().toISOString(),
    });
    return this.#retry.run(() => this.#settle(siteId));
  }

  // Re-reads every vote, so concurrent voters converge on the same tally.
  async #settle(siteId: string): Promise<VoteResult> {
    const site = await this.#load(siteId);
    const before = site.verification;
    site.recordVotes(VoteTally.of(await this.#deps.votes.forSite(siteId)));
    await this.#deps.sites.save(site);
    if (site.verification !== before) {
      await this.#deps.reports.followSite(site.reportIds, site.verification);
    }
    return site.voteResult();
  }

  async #load(siteId: string): Promise<Site> {
    const site = await this.#deps.sites.get(siteId);
    if (site === null) {
      throw new SiteNotFoundError(`No site ${siteId}`);
    }
    return site;
  }
}
