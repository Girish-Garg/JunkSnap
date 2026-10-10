import type { NoteRequest, SiteNote } from '../domain/Community';
import type { CleanupAccepted, CleanupRequest, LetterDraft, LetterRequest, VoteRequest, VoteResult, WithdrawalResult } from '../domain/SiteActions';
import type { SiteCacheEviction } from './SiteCacheEviction';
import type { SiteActionsApi } from './SiteActionsApi';

/** Forgets the cached site and site tiles after a vote, cleanup or withdrawal, whether or not the server took it. */
export class EvictingSiteActionsApi implements SiteActionsApi {
  readonly #inner: SiteActionsApi;
  readonly #eviction: SiteCacheEviction;

  constructor(inner: SiteActionsApi, eviction: SiteCacheEviction) {
    this.#inner = inner;
    this.#eviction = eviction;
  }

  vote(siteId: string, request: VoteRequest): Promise<VoteResult> {
    return this.#evictAfter(siteId, this.#inner.vote(siteId, request));
  }

  cleanup(siteId: string, request: CleanupRequest): Promise<CleanupAccepted> {
    return this.#evictAfter(siteId, this.#inner.cleanup(siteId, request));
  }

  withdraw(siteId: string): Promise<WithdrawalResult> {
    return this.#evictAfter(siteId, this.#inner.withdraw(siteId));
  }

  letter(siteId: string, request: LetterRequest): Promise<LetterDraft> {
    return this.#inner.letter(siteId, request);
  }

  note(siteId: string, request: NoteRequest): Promise<SiteNote> {
    return this.#inner.note(siteId, request);
  }

  // A refused write may still mean the site moved on (409 already_cleaned), so a failure evicts too.
  #evictAfter<T>(siteId: string, write: Promise<T>): Promise<T> {
    return write.finally(() => this.#eviction.forgetSite(siteId));
  }
}
