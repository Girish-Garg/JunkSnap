import { JunkSnapError, NotFoundError, ValidationError, type ErrorCode } from "../errors.js";

export class SiteNotFoundError extends NotFoundError {}

export class BboxTooLargeError extends ValidationError {
  override readonly code: ErrorCode = "bbox_too_large";
}

export class OwnSiteError extends JunkSnapError {
  override readonly code: ErrorCode = "own_site";
}

export class TooFarError extends JunkSnapError {
  override readonly code: ErrorCode = "too_far";
}

// A lifecycle method called in a state that forbids it; only the subclasses can come from a caller.
export class InvalidTransitionError extends JunkSnapError {}

export class CleanupPendingError extends InvalidTransitionError {
  override readonly code: ErrorCode = "cleanup_pending";
}

export class AlreadyCleanedError extends InvalidTransitionError {
  override readonly code: ErrorCode = "already_cleaned";
}

// A rejected site is hidden from the map and takes no more votes.
export class SiteRejectedError extends InvalidTransitionError {
  override readonly code: ErrorCode = "site_rejected";
}

// Decision 20261010-1700: a verified site rests on 10 people, so its reports can no longer be withdrawn.
export class SiteVerifiedError extends InvalidTransitionError {
  override readonly code: ErrorCode = "site_verified";
}

// Every report on the site was withdrawn; it is kept for the audit trail but takes nothing new.
export class SiteRemovedError extends NotFoundError {}

// Decision 20261010-1855: 90 days without a report, vote or cleanup photo; kept for the audit trail but takes nothing new.
export class SiteExpiredError extends NotFoundError {}

// Another writer saved the site first; the caller reloads and tries again.
export class StaleSiteError extends JunkSnapError {}
