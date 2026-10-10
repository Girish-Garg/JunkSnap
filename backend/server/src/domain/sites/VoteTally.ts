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

  private constructor(yesPeople: readonly string[], noPeople: readonly string[]) {
    this.yesPeople = yesPeople;
    this.noPeople = noPeople;
  }

  static of(votes: readonly Vote[]): VoteTally {
    const latest = new Map<string, Vote>();
    for (const vote of votes) {
      const kept = latest.get(personOf(vote));
      if (kept === undefined || Date.parse(vote.votedAt) > Date.parse(kept.votedAt)) {
        latest.set(personOf(vote), vote);
      }
    }
    const people = (choice: VoteChoice) => [...latest].filter(([, vote]) => vote.choice === choice).map(([person]) => person);
    return new VoteTally(people("confirm"), people("reject"));
  }

  get confirm(): number {
    return this.yesPeople.length;
  }

  get reject(): number {
    return this.noPeople.length;
  }
}
