import { NotVerifiedError } from "../../domain/letters/errors.js";
import type { LetterSite } from "../../domain/letters/LetterSite.js";

const PEOPLE_NEEDED = 10;

// Decision 20261010-1630: a no-bin letter needs a verified zone (10 people); a mapped bin is evidence, never a gate.
export class NoBinEligibility {
  readonly #radiusM: number;

  constructor(radiusM: number) {
    this.#radiusM = radiusM;
  }

  check(site: LetterSite): void {
    if (site.reportType !== "no_bin" || site.verified) {
      return;
    }
    const count = Math.min(site.evidence.reporters ?? 0, PEOPLE_NEEDED - 1);
    throw new NotVerifiedError(`${count} of ${PEOPLE_NEEDED} people have confirmed no dustbin within 1 km here; a no-bin letter needs ${PEOPLE_NEEDED}.`);
  }

  get radiusM(): number {
    return this.#radiusM;
  }
}
