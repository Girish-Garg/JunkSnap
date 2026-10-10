import type { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import type { PerceptualHash } from "../../../domain/moderation/PerceptualHash.js";
import type { PhotoSubmission } from "../../../domain/moderation/PhotoSubmission.js";
import type { CheckKey, RejectReason } from "../../../domain/moderation/types.js";

export interface CheckSubject {
  readonly submission: PhotoSubmission;
  readonly hash: PerceptualHash;
}

// One authenticity check; `reason` is the rejection reason when it fails.
export interface Check {
  readonly key: CheckKey;
  readonly reason: RejectReason;
  run(subject: CheckSubject): Promise<CheckOutcome>;
}
