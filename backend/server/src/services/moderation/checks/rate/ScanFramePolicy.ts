import { CheckOutcome } from "../../../../domain/moderation/CheckOutcome.js";
import type { RatePolicy } from "./RatePolicy.js";

// The worker's frame sampler already keeps at most one frame per second of video.
export class ScanFramePolicy implements RatePolicy {
  async assess(): Promise<CheckOutcome> {
    return CheckOutcome.pass("scan frame; the frame sampler keeps 1 per second");
  }
}
