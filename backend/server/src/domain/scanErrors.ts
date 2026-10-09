import { JunkSnapError, ValidationError, type ErrorCode } from "./errors.js";

// The scan fails for good with reason invalid_video; a retry cannot help.
export class InvalidVideoError extends JunkSnapError {}

export class ScanTooLargeError extends ValidationError {
  override readonly code: ErrorCode = "scan_too_large";
}
