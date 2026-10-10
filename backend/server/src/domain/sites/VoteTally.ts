import type { VoteChoice } from "./SiteTypes.js";
import { personOf } from "./utils.js";

// Decision 20261010-1700: cleared once 3 more people say cleared than say still there, like the no-vote valve.
const CLEARED_MARGIN = 3;

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

  // Cleared votes count after the newest photo (a reopened site needs fresh ones); yes votes after the first of them dispute it.
  // Returns the deciding vote's time, or null until cleared voters lead by the margin.
  clearedAt(since: string): string | null {
    const times = this.#latest
      .filter((vote) => vote.choice === "cleaned" && Date.parse(vote.votedAt) > Date.parse(since))
      .map((vote) => Date.parse(vote.votedAt))
      .sort((a, b) => a - b);
    const first = times[0] ?? Infinity;
    const stillThere = this.#latest.filter((vote) => vote.choice === "confirm" && Date.parse(vote.votedAt) > first).length;
    const last = times.at(-1);
    return last === undefined || times.length - stillThere < CLEARED_MARGIN ? null : new Date(last).toISOString();
  }

  #people(choice: VoteChoice): string[] {
    return this.#latest.filter((vote) => vote.choice === choice).map(personOf);
  }
}
