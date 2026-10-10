import type { CleanupAccepted, CleanupRequest, LetterDraft, LetterRequest, VoteRequest, VoteResult } from '../domain/SiteActions';

/** POST /sites/{id}/votes, /cleanup and /letters. All need sign-in; failures reject with ApiError. */
export interface SiteActionsApi {
  /** 403 own_site for the reporter; 403 too_far beyond 1 km. */
  vote(siteId: string, request: VoteRequest): Promise<VoteResult>;
  /** 409 cleanup_pending or already_cleaned. */
  cleanup(siteId: string, request: CleanupRequest): Promise<CleanupAccepted>;
  /** Up to 60 s. 409 not_verified, 422 no_local_body, 429 rate_limited. */
  letter(siteId: string, request: LetterRequest): Promise<LetterDraft>;
}
