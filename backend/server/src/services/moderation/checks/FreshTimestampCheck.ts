import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import { formatDuration } from "../../../domain/moderation/utils.js";
import type { ModerationRules } from "../../../domain/moderation/ModerationRules.js";
import type { Check, CheckSubject } from "./Check.js";

// PHOTO_MAX_AGE_HOURS and PHOTO_MAX_AHEAD_MINUTES.
export class FreshTimestampCheck implements Check {
  readonly key = "fresh_timestamp";
  readonly reason = "stale_timestamp";
  readonly #rules: Pick<ModerationRules, "maxAgeS" | "maxAheadS">;

  constructor(rules: Pick<ModerationRules, "maxAgeS" | "maxAheadS">) {
    this.#rules = rules;
  }

  async run({ submission }: CheckSubject): Promise<CheckOutcome> {
    const { capturedAt, receivedAt } = submission.fields;
    const ageS = (receivedAt.getTime() - capturedAt.getTime()) / 1000;
    if (Number.isNaN(ageS)) {
      return CheckOutcome.fail("capture time missing or unreadable");
    }
    const { maxAgeS, maxAheadS } = this.#rules;
    if (ageS < 0) {
      const detail = `captured ${formatDuration(ageS)} after upload; limit ${formatDuration(maxAheadS)}`;
      return -ageS > maxAheadS ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
    }
    const detail = `captured ${formatDuration(ageS)} before upload; limit ${formatDuration(maxAgeS)}`;
    return ageS > maxAgeS ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
  }
}
