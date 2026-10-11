import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import { InternalDataError } from "../../../domain/errors.js";
import type { Check, CheckSubject } from "./Check.js";

// Cleanup after-photos only: the photo must be taken at the site it claims to clear.
export class NearSiteCheck implements Check {
  readonly key = "near_site";
  readonly reason = "not_near_site";
  readonly #maxM: number;

  // maxM: CLEANUP_NEAR_SITE_M.
  constructor(maxM: number) {
    this.#maxM = maxM;
  }

  async run({ submission }: CheckSubject): Promise<CheckOutcome> {
    const { site, location } = submission.fields;
    if (site === null) {
      throw new InternalDataError("near_site check on a photo without a site");
    }
    // Rounding up keeps the shown distance and the comparison in agreement: 50.2 m shows 51 and fails a 50 m limit.
    const metres = Math.ceil(location.distanceTo(site.point));
    const detail = `after-photo ${metres} m from the site; limit ${this.#maxM} m`;
    return metres > this.#maxM ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
  }
}
