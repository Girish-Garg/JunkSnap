import { ApiError } from '../domain/ApiError';
import type { CleanupAccepted, CleanupRequest, LetterDraft, LetterRequest, VoteRequest, VoteResult } from '../domain/SiteActions';
import { NO_BIN_MIN_REPORTERS } from '../domain/BinAccess';
import type { SiteFeature, SiteProperties } from '../domain/Site';
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

  constructor(sources: MockSiteSources, delayMs = 400) {
    this.#sources = sources;
    this.#delayMs = delayMs;
  }

  async vote(siteId: string, request: VoteRequest): Promise<VoteResult> {
    await this.#wait();
    const { votes, backers, verification } = (await this.#sources.site(siteId)).properties;
    const yes = request.vote === 'confirm';
    const counted = yes ? { ...votes, confirm: votes.confirm + 1 } : { ...votes, reject: votes.reject + 1 };
    const backed = yes ? { ...backers, count: backers.count + 1, vote_people: backers.vote_people + 1 } : backers;
    return { site_id: siteId, votes: counted, backers: backed, verification };
  }

  async cleanup(siteId: string, request: CleanupRequest): Promise<CleanupAccepted> {
    await this.#wait();
    return { cleanup_id: request.upload_id.replace(/^upl_/, 'cln_'), site_id: siteId, status: 'checking' };
  }

  async letter(siteId: string, request: LetterRequest): Promise<LetterDraft> {
    await this.#wait();
    const site = (await this.#sources.site(siteId)).properties;
    if (site.verification !== 'verified') throw new ApiError(409, 'not_verified', 'Letters open once the site is verified');
    const noBin = MockSiteActionsApi.#noBinReason(site);
    if (noBin) throw new ApiError(409, 'not_verified', noBin);
    const sample = await this.#sources.letter();
    return { ...sample, site_id: siteId, language: request.language };
  }

  // The api's no-bin gate (decision 20261010-1430), worded as the api words it.
  static #noBinReason(site: SiteProperties): string | null {
    if (site.report_type !== 'no_bin') return null;
    const reporters = site.reporters ?? 0;
    const noBinWithin3km = site.insights?.no_bin_within_3km;
    if (reporters >= NO_BIN_MIN_REPORTERS && noBinWithin3km === true) return null;
    if (noBinWithin3km === null || noBinWithin3km === undefined) return 'Bins not mapped here yet, so a no-bin letter cannot be checked.';
    return `${reporters} of ${NO_BIN_MIN_REPORTERS} people reported no bin here${MockSiteActionsApi.#nearest(site)}`;
  }

  static #nearest(site: SiteProperties): string {
    const bin = site.insights?.nearest_bin;
    return bin ? `; nearest known bin ${(bin.distance_m / 1000).toFixed(1)} km` : '';
  }

  #wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.#delayMs));
  }
}
