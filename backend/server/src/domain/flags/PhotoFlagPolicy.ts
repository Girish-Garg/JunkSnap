import type { PhotoFlagRules } from "../sites/SiteRules.js";
import type { FlagAuthor, PhotoFlagState } from "./PhotoFlag.js";

// Decision 20261011-0310-hem-photo-flags: nothing happens on one person's word. The thresholds are PHOTO_FLAG_WARN,
// PHOTO_FLAG_HIDE, PHOTO_FLAG_HIDE_EARLY and PHOTO_FLAG_SURPLUS (fewer reports hide a photo early only when they
// outnumber the people backing it by the surplus).
// Turns a photo's reports into its warned and hidden state; hidden is final.
export class PhotoFlagPolicy {
  readonly #rules: PhotoFlagRules;

  constructor(rules: PhotoFlagRules) {
    this.#rules = rules;
  }

  // Rows are one per user; two accounts on one device still count once.
  people(authors: readonly FlagAuthor[]): number {
    const users = new Set(authors.map((author) => author.authorHash)).size;
    const devices = new Set(authors.map((author) => author.deviceHash)).size;
    return Math.min(users, devices);
  }

  warns(people: number): boolean {
    return people >= this.#rules.warn;
  }

  // backers: people backing the site other than the photo's own reporter.
  state(people: number, backers: number, wasHidden: boolean): PhotoFlagState {
    const { hide, hideEarly, surplus } = this.#rules;
    const early = people >= hideEarly && people - backers >= surplus;
    const hidden = wasHidden || people >= hide || early;
    return { count: people, warned: hidden || this.warns(people), hidden };
  }

  // A site goes only when its reporters outnumber every backer, the photo's reporter included, by the surplus.
  removesSite(reporters: number, backers: number): boolean {
    return reporters - backers >= this.#rules.surplus;
  }
}
