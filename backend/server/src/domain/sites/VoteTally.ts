import type { Verification, VoteChoice } from "./SiteTypes.js";

const BASE_WEIGHT = 0.5;
const SETTLE_AT = 3;
const ROUNDING = 1e6;

export interface Vote {
  readonly siteId: string;
  readonly deviceToken: string;
  readonly userId: string | null;
  readonly choice: VoteChoice;
  readonly weight: number;
  readonly votedAt: string;
}

// Community check: confirm weights minus reject weights, settling at +3 or -3 (contracts/README.md).
export class VoteTally {
  readonly confirm: number;
  readonly reject: number;
  readonly #net: number;

  private constructor(confirm: number, reject: number, net: number) {
    this.confirm = confirm;
    this.reject = reject;
    this.#net = net;
  }

  // Takes one vote per device (the votes table key); keeps only the latest vote per user on top.
  static of(votes: readonly Vote[]): VoteTally {
    const counted = VoteTally.#latestPerUser(votes);
    const confirms = counted.filter((vote) => vote.choice === "confirm");
    const rejects = counted.filter((vote) => vote.choice === "reject");
    const net = VoteTally.#sum(confirms) - VoteTally.#sum(rejects);
    return new VoteTally(confirms.length, rejects.length, Math.round(net * ROUNDING) / ROUNDING);
  }

  // reputation is the lower of the user's and the device's; a new one (0.5) counts 1.0.
  static weightFor(reputation: number): number {
    return BASE_WEIGHT + Math.min(1, Math.max(0, reputation));
  }

  outcome(): Verification | null {
    if (this.#net >= SETTLE_AT) {
      return "verified";
    }
    return this.#net <= -SETTLE_AT ? "rejected" : null;
  }

  static #latestPerUser(votes: readonly Vote[]): Vote[] {
    const latest = new Map<string, Vote>();
    for (const vote of votes) {
      const voter = vote.userId === null ? `device ${vote.deviceToken}` : `user ${vote.userId}`;
      const kept = latest.get(voter);
      if (kept === undefined || Date.parse(vote.votedAt) > Date.parse(kept.votedAt)) {
        latest.set(voter, vote);
      }
    }
    return [...latest.values()];
  }

  static #sum(votes: readonly Vote[]): number {
    return votes.reduce((total, vote) => total + vote.weight, 0);
  }
}
