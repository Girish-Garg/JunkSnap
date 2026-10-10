import type { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import type { CaptureMode } from "../../../domain/moderation/PhotoSubmission.js";
import type { DeviceRegistry } from "../../../ports/moderation/DeviceRegistry.js";
import type { Check, CheckSubject } from "./Check.js";
import type { RatePolicy } from "./rate/RatePolicy.js";
import { ScanFramePolicy } from "./rate/ScanFramePolicy.js";
import { SnapRatePolicy } from "./rate/SnapRatePolicy.js";

// contracts/README.md: Snap 20 photos per hour per user and per device; scan frames never count toward it.
export class RateLimitCheck implements Check {
  readonly key = "rate_limit";
  readonly reason = "rate_limited";
  readonly #policies: Readonly<Record<CaptureMode, RatePolicy>>;

  constructor(devices: DeviceRegistry) {
    this.#policies = { snap: new SnapRatePolicy(devices), scan: new ScanFramePolicy() };
  }

  run({ submission }: CheckSubject): Promise<CheckOutcome> {
    return this.#policies[submission.fields.captureMode].assess(submission);
  }
}
