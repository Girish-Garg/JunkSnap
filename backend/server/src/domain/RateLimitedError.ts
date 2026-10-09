import { JunkSnapError, type ErrorCode } from "./errors.js";

export class RateLimitedError extends JunkSnapError {
  override readonly code: ErrorCode = "rate_limited";
}
