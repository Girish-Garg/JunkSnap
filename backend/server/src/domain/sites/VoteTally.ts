import type { Verification, VoteChoice } from "./SiteTypes.js";

const BASE_WEIGHT = 0.5;
const SETTLE_AT = 3;
const ROUNDING = 1e6;

export interface Vote {
  readonly siteId: string;
  readonly deviceToken: string;
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

  // Callers pass one vote per device, the latest; the votes table key guarantees it.
  static of(votes: readonly Vote[]): VoteTally {
    const confirms = votes.filter((vote) => vote.choice === "confirm");
    const rejects = votes.filter((vote) => vote.choice === "reject");
    const net = VoteTally.#sum(confirms) - VoteTally.#sum(rejects);
    return new VoteTally(confirms.length, rejects.length, Math.round(net * ROUNDING) / ROUNDING);
  }

  // A new device (reputation 0.5) counts 1.0.
  static weightFor(reputation: number): number {
    return BASE_WEIGHT + Math.min(1, Math.max(0, reputation));
  }

  outcome(): Verification | null {
    if (this.#net >= SETTLE_AT) {
      return "verified";
    }
    return this.#net <= -SETTLE_AT ? "rejected" : null;
  }

  static #sum(votes: readonly Vote[]): number {
    return votes.reduce((total, vote) => total + vote.weight, 0);
  }
}
