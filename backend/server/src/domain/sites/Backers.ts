import type { SiteProperties, Verification } from "./SiteTypes.js";

// Fixed by the site contract (backers.needed is const 10), so not a setting.
export const BACKERS_NEEDED = 10;

export type BackersView = SiteProperties["backers"];

// People backing a site by a model-passed photo or a yes vote, each once (decision 20261010-1530).
export class Backers {
  readonly #photo: ReadonlySet<string>;
  readonly #yes: ReadonlySet<string>;
  readonly #no: ReadonlySet<string>;
  readonly #rejectMargin: number;

  // rejectMargin: REJECT_MARGIN.
  constructor(photoPeople: readonly string[], yesPeople: readonly string[], noPeople: readonly string[], rejectMargin: number) {
    this.#rejectMargin = rejectMargin;
    this.#photo = new Set(photoPeople);
    this.#yes = new Set(yesPeople);
    // A person who sent a photo of the site backs it, whatever their latest vote says.
    this.#no = new Set(noPeople.filter((person) => !this.#photo.has(person)));
  }

  get count(): number {
    return new Set([...this.#photo, ...this.#yes]).size;
  }

  // A verified site never shows fewer backers than it had when it became verified.
  view(frozen: number | null): BackersView {
    const count = Math.max(this.count, frozen ?? 0);
    return { count, needed: BACKERS_NEEDED, photo_people: this.#photo.size, vote_people: this.#yes.size };
  }

  // The count to keep once verified: the earlier frozen value, else today's (at least the 10 needed).
  frozenAt(previous: number | null): number {
    return previous ?? Math.max(this.count, BACKERS_NEEDED);
  }

  // Null while neither threshold is met: 10 backers verify, no voters rejectMargin or more ahead reject.
  outcome(): Exclude<Verification, "unverified"> | null {
    if (this.count >= BACKERS_NEEDED) {
      return "verified";
    }
    return this.#no.size - this.count >= this.#rejectMargin ? "rejected" : null;
  }
}
