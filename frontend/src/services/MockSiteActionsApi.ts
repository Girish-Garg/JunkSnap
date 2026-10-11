import { NETWORK_DEFAULTS } from '../config/NetworkSettings';
import { ApiError } from '../domain/ApiError';
import type { NoteRequest, SiteNote } from '../domain/Community';
import type { PhotoFlagRequest, PhotoFlagResult } from '../domain/PhotoFlag';
import type { CleanupAccepted, CleanupRequest, LetterDraft, LetterRequest, VoteRequest, VoteResult, WithdrawalResult } from '../domain/SiteActions';
import type { SiteFeature } from '../domain/Site';
import type { SiteActionsApi } from './SiteActionsApi';

export interface MockSiteSources {
  readonly site: (siteId: string) => Promise<SiteFeature>;
  /** contracts/fixtures/letter_draft.jdh-1.json */
  readonly letter: () => Promise<LetterDraft>;
}

/** Mock mode: answers from the fixtures; nothing leaves the phone. */
export class MockSiteActionsApi implements SiteActionsApi {
  readonly #sources: MockSiteSources;
  readonly #delayMs: number;

  constructor(sources: MockSiteSources, delayMs = NETWORK_DEFAULTS.mockDelayMs) {
    this.#sources = sources;
    this.#delayMs = delayMs;
  }

  async vote(siteId: string, request: VoteRequest): Promise<VoteResult> {
    await this.#wait();
    const { votes, backers, verification } = (await this.#sources.site(siteId)).properties;
    const yes = request.vote === 'confirm';
    const counted = { ...votes, [request.vote]: (votes[request.vote] ?? 0) + 1 };
    const backed = yes ? { ...backers, count: backers.count + 1, vote_people: backers.vote_people + 1 } : backers;
    return { site_id: siteId, votes: counted, backers: backed, verification };
  }

  /** Mock mode shows the note at once; the real api moderates it first. */
  async note(siteId: string, request: NoteRequest): Promise<SiteNote> {
    await this.#wait();
    const created = new Date().toISOString();
    return { note_id: `note_mock${Date.now()}`, site_id: siteId, status: 'shown', text: request.text, language: request.language, created_at: created };
  }

  /** Mock mode: the sample reporter was the site's only backer, so the site leaves the map. */
  async withdraw(siteId: string): Promise<WithdrawalResult> {
    await this.#wait();
    const { verification, backers } = (await this.#sources.site(siteId)).properties;
    if (verification === 'verified') throw new ApiError(409, 'site_verified', 'Ten people have verified this site');
    return { site_id: siteId, withdrawn_report_ids: [], site_removed: true, status: 'removed', verification, backers };
  }

  /** Mock mode counts this phone's report on top of the fixture's; nothing is covered or hidden here. */
  async flagPhoto(siteId: string, photoId: string, request: PhotoFlagRequest): Promise<PhotoFlagResult> {
    await this.#wait();
    const { photo_flags: flags = [], status } = (await this.#sources.site(siteId)).properties;
    const before = flags.find((entry) => entry.photo_id === photoId) ?? { count: 0, warned: false, hidden: false };
    const photo = { count: before.count + 1, warned: before.warned, hidden: before.hidden };
    const text_status = request.text ? 'shown' : 'none';
    return { site_id: siteId, photo_id: photoId, reason: request.reason, text_status, photo, site_status: status, created_at: new Date().toISOString() };
  }

  async cleanup(siteId: string, request: CleanupRequest): Promise<CleanupAccepted> {
    await this.#wait();
    return { cleanup_id: request.upload_id.replace(/^upl_/, 'cln_'), site_id: siteId, status: 'checking' };
  }

  async letter(siteId: string, request: LetterRequest): Promise<LetterDraft> {
    await this.#wait();
    const site = (await this.#sources.site(siteId)).properties;
    if (site.verification !== 'verified') throw new ApiError(409, 'not_verified', 'Letters open once the site is verified');
    const sample = await this.#sources.letter();
    return { ...sample, site_id: siteId, language: request.language };
  }

  #wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.#delayMs));
  }
}
