import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import { formatDuration } from "../../../domain/moderation/utils.js";
import type { Check, CheckSubject } from "./Check.js";

// Room for the phone's offline queue, and for a phone clock running a little fast.
const MAX_AGE_S = 72 * 3600;
const MAX_AHEAD_S = 5 * 60;

export class FreshTimestampCheck implements Check {
  readonly key = "fresh_timestamp";
  readonly reason = "stale_timestamp";

  async run({ submission }: CheckSubject): Promise<CheckOutcome> {
    const { capturedAt, receivedAt } = submission.fields;
    const ageS = (receivedAt.getTime() - capturedAt.getTime()) / 1000;
    if (Number.isNaN(ageS)) {
      return CheckOutcome.fail("capture time missing or unreadable");
    }
    if (ageS < 0) {
      const detail = `captured ${formatDuration(ageS)} after upload; limit 5 min`;
      return -ageS > MAX_AHEAD_S ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
    }
    const detail = `captured ${formatDuration(ageS)} before upload; limit 72 h`;
    return ageS > MAX_AGE_S ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
  }
}
