import { ApiError } from '../src/domain/ApiError';
import type { CleanupAccepted, CleanupRequest, LetterDraft, LetterRequest, VoteRequest, VoteResult } from '../src/domain/SiteActions';
import { sampleLetterLoader } from '../src/services/siteFixtures';
import type { SiteActionsApi } from '../src/services/SiteActionsApi';

type Call = 'vote' | 'cleanup' | 'letter';

/** Records every call with its site id and body; failNext makes the next call of a kind fail. */
export class FakeSiteActionsApi implements SiteActionsApi {
  readonly calls: { readonly kind: Call; readonly siteId: string; readonly body: unknown }[] = [];
  readonly #failures = new Map<Call, ApiError>();

  failNext(kind: Call, status: number, code: string): void {
    this.#failures.set(kind, new ApiError(status, code, `${kind} failed`));
  }

  async vote(siteId: string, request: VoteRequest): Promise<VoteResult> {
    this.#record('vote', siteId, request);
    return { site_id: siteId, votes: { confirm: 3, reject: 1 }, verification: 'verified' };
  }

  async cleanup(siteId: string, request: CleanupRequest): Promise<CleanupAccepted> {
    this.#record('cleanup', siteId, request);
    return { cleanup_id: request.upload_id.replace(/^upl_/, 'cln_'), site_id: siteId, status: 'checking' };
  }

  async letter(siteId: string, request: LetterRequest): Promise<LetterDraft> {
    this.#record('letter', siteId, request);
    return { ...(await sampleLetterLoader()), site_id: siteId, language: request.language };
  }

  #record(kind: Call, siteId: string, body: unknown): void {
    this.calls.push({ kind, siteId, body });
    const failure = this.#failures.get(kind);
    this.#failures.delete(kind);
    if (failure) throw failure;
  }
}
