import { JunkSnapError, type ErrorCode } from "./errors.js";

// A long-range target past the cap (decision 20261011-0400-hem-long-range-target).
export class TargetTooFarError extends JunkSnapError {
  override readonly code: ErrorCode = "target_too_far";
}
