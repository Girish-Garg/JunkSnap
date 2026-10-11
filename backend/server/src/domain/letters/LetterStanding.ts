import type { Site } from "../../contracts/index.gen.js";
import { NotFoundError } from "../errors.js";
import { isLapsed } from "../SiteExpiry.js";
import { SiteRejectedError, SiteRemovedError } from "../sites/SiteErrors.js";

type Facts = Site["properties"];

// Decision 20261011-1750: any site still standing takes a letter, verified or not; the letter says which.
export class LetterStanding {
  readonly #ttlDays: number;

  // ttlDays: SITE_TTL_DAYS.
  constructor(ttlDays: number) {
    this.#ttlDays = ttlDays;
  }

  check(facts: Facts, now: Date): void {
    const id = facts.site_id;
    if (facts.status === "removed") {
      throw new SiteRemovedError(`Site ${id} was removed, so it takes no letter`);
    }
    if (facts.verification === "rejected") {
      throw new SiteRejectedError(`Site ${id} was hidden after a neighbour check, so it takes no letter`);
    }
    // Decision 20261010-1855: an expired site takes no letter, even before the CronJob marks it.
    if (isLapsed(facts, now, this.#ttlDays)) {
      throw new NotFoundError(`Site ${id} expired after ${this.#ttlDays} days without activity`);
    }
  }
}
