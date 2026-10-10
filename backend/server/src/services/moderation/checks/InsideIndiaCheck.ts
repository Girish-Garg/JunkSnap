import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import type { Geofence } from "../../../ports/moderation/Geofence.js";
import type { Check, CheckSubject } from "./Check.js";

export class InsideIndiaCheck implements Check {
  readonly key = "inside_india";
  readonly reason = "outside_india";
  readonly #india: Geofence;

  constructor(india: Geofence) {
    this.#india = india;
  }

  async run({ submission }: CheckSubject): Promise<CheckOutcome> {
    return this.#india.covers(submission.fields.location)
      ? CheckOutcome.pass("point inside the India boundary")
      : CheckOutcome.fail("point outside the India boundary");
  }
}
