import type { CheckOutcome } from "../../../../domain/moderation/CheckOutcome.js";
import type { PhotoSubmission } from "../../../../domain/moderation/PhotoSubmission.js";

// How one capture mode is rate limited.
export interface RatePolicy {
  assess(submission: PhotoSubmission): Promise<CheckOutcome>;
}
