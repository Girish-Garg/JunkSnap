import type { VoteChoice } from "./SiteTypes.js";
import { personOf } from "./utils.js";

export interface Vote {
  readonly siteId: string;
  readonly deviceToken: string;
  readonly userId: string | null;
  readonly choice: VoteChoice;
  readonly votedAt: string;
}

// Each person's latest vote; votes carry no weight.
export class VoteTally {
  readonly yesPeople: readonly string[];
  readonly noPeople: readonly string[];
  readonly #latest: readonly Vote[];

  private constructor(latest: readonly Vote[]) {
    this.#latest = latest;
    this.yesPeople = this.#people("confirm");
    this.noPeople = this.#people("reject");
  }

  static of(votes: readonly Vote[]): VoteTally {
    const latest = new Map<string, Vote>();
    for (const vote of votes) {
      const kept = latest.get(personOf(vote));
      if (kept === undefined || Date.parse(vote.votedAt) > Date.parse(kept.votedAt)) {
        latest.set(personOf(vote), vote);
      }
    }
    return new VoteTally([...latest.values()]);
  }

  get confirm(): number {
    return this.yesPeople.length;
  }

  get reject(): number {
    return this.noPeople.length;
  }

  get cleaned(): number {
    return this.#people("cleaned").length;
  }

  // Each person's latest vote, for the clearance count (decision 20261010-1855).
  latest(): readonly Vote[] {
    return this.#latest;
  }

  // The newest vote's time, which refreshes the site's expiry; null with no votes.
  lastVotedAt(): string | null {
    const times = this.#latest.map((vote) => Date.parse(vote.votedAt));
    return times.length === 0 ? null : new Date(Math.max(...times)).toISOString();
  }

  #people(choice: VoteChoice): string[] {
    return this.#latest.filter((vote) => vote.choice === choice).map(personOf);
  }
}
