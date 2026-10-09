import { JunkSnapError, ValidationError } from "./errors.js";

// The scan fails for good with reason invalid_video; a retry cannot help.
export class InvalidVideoError extends JunkSnapError {}

// Becomes 400 scan_too_large once contracts PR #39 adds that code.
export class ScanTooLargeError extends ValidationError {}
