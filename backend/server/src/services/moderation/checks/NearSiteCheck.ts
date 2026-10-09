import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import { InternalDataError } from "../../../domain/errors.js";
import type { Check, CheckSubject } from "./Check.js";

const MAX_DISTANCE_M = 50;

// Cleanup after-photos only: the photo must be taken at the site it claims to clear.
export class NearSiteCheck implements Check {
  readonly key = "near_site";
  readonly reason = "not_near_site";

  async run({ submission }: CheckSubject): Promise<CheckOutcome> {
    const { site, location } = submission.fields;
    if (site === null) {
      throw new InternalDataError("near_site check on a photo without a site");
    }
    const metres = Math.round(location.distanceTo(site));
    const detail = `after-photo ${metres} m from the site; limit ${MAX_DISTANCE_M} m`;
    return metres > MAX_DISTANCE_M ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
  }
}
