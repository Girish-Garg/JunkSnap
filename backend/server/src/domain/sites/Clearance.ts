import type { ClearanceRules } from "./SiteRules.js";
import type { CleanupConfirmation, SiteProperties } from "./SiteTypes.js";
import type { VoteTally } from "./VoteTally.js";
import { personOf } from "./utils.js";

export type ClearanceView = NonNullable<SiteProperties["clearance"]>;

// One person's latest word on the site: cleared (an accepted after-photo or a cleaned vote) or still there (a yes vote).
interface Word {
  readonly person: string;
  readonly cleared: boolean;
  readonly stillThere: boolean;
  // The word is an accepted after-photo, not a vote.
  readonly photo: boolean;
  readonly at: number;
}

// Counts who says the site is cleared since its newest photo; each person once, by their latest word.
// Decision 20261010-1855: at least cleanedQuorum people (CLEANED_QUORUM), and clearedMargin (CLEARED_MARGIN) more
// than the people saying still there (decision 20261010-1700).
export class Clearance {
  readonly #cleared: readonly Word[];
  readonly #stillThere: number;
  readonly #rules: ClearanceRules;

  private constructor(words: readonly Word[], since: string, rules: ClearanceRules) {
    this.#rules = rules;
    const after = Date.parse(since);
    this.#cleared = words.filter((word) => word.cleared && word.at > after).sort((a, b) => a.at - b.at);
    const first = this.#cleared[0]?.at ?? Infinity;
    this.#stillThere = words.filter((word) => word.stillThere && word.at > first).length;
  }

  // since is the site's last_reported_at: a reopened site needs fresh words.
  static of(tally: VoteTally, photos: readonly CleanupConfirmation[], since: string, rules: ClearanceRules): Clearance {
    const votes = tally.latest().map((vote) => ({
      person: personOf(vote),
      cleared: vote.choice === "cleaned",
      stillThere: vote.choice === "confirm",
      photo: false,
      at: Date.parse(vote.votedAt),
    }));
    const shots = photos.map((photo) => ({ person: photo.person, cleared: true, stillThere: false, photo: true, at: Date.parse(photo.at) }));
    return new Clearance(Clearance.#latestPerPerson([...votes, ...shots]), since, rules);
  }

  get count(): number {
    return this.#cleared.length;
  }

  view(): ClearanceView {
    const needed = Math.max(this.#rules.cleanedQuorum, this.#stillThere + this.#rules.clearedMargin);
    return { count: this.count, needed, still_there: this.#stillThere };
  }

  // The deciding word's time once enough people say cleared, else null.
  clearedAt(): string | null {
    const last = this.#cleared.at(-1);
    return last === undefined || this.count < this.view().needed ? null : new Date(last.at).toISOString();
  }

  // An accepted after-photo is among the words that cleared it.
  byPhoto(): boolean {
    return this.#cleared.some((word) => word.photo);
  }

  static #latestPerPerson(words: readonly Word[]): Word[] {
    const latest = new Map<string, Word>();
    for (const word of words) {
      const kept = latest.get(word.person);
      if (kept === undefined || word.at > kept.at) {
        latest.set(word.person, word);
      }
    }
    return [...latest.values()];
  }
}
