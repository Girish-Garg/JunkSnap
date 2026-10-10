// HTTP status per error code, exactly as listed in contracts/README.md.
const HTTP_STATUS = {
  bad_request: 400,
  bbox_too_large: 400,
  scan_too_large: 400,
  unauthorized: 401,
  forbidden: 403,
  own_site: 403,
  too_far: 403,
  not_found: 404,
  area_not_found: 404,
  cleanup_pending: 409,
  already_cleaned: 409,
  not_verified: 409,
  site_rejected: 409,
  site_verified: 409,
  confirmation_closed: 409,
  no_local_body: 422,
  target_too_far: 422,
  rate_limited: 429,
  server_error: 500,
} as const;

export type ErrorCode = keyof typeof HTTP_STATUS;

// Subclasses set only `code`; the status follows from it, so the two never disagree.
export class JunkSnapError extends Error {
  readonly code: ErrorCode = "server_error";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }
}

export class ConfigError extends JunkSnapError {}

export class NotFoundError extends JunkSnapError {
  override readonly code: ErrorCode = "not_found";
}

export class ValidationError extends JunkSnapError {
  override readonly code: ErrorCode = "bad_request";
}

// No token, or a token that is malformed, expired or not from our user pool.
export class UnauthorizedError extends JunkSnapError {
  override readonly code: ErrorCode = "unauthorized";
}

// Only for a user blocked in the users table; a user who does not own an item gets NotFoundError, as if it were missing.
export class ForbiddenError extends JunkSnapError {
  override readonly code: ErrorCode = "forbidden";
}

// Adapters translate SDK and HTTP failures into this.
export class ExternalServiceError extends JunkSnapError {}

// Stored, internal or outbound data broke a contract: our bug, never the caller's.
export class InternalDataError extends JunkSnapError {}
