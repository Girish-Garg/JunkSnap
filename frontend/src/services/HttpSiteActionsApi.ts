import type { CleanupAccepted, CleanupRequest, LetterDraft, LetterRequest, VoteRequest, VoteResult } from '../domain/SiteActions';
import { HttpTransport } from './HttpTransport';
import type { RequestIdentity } from './ReportApi';
import type { SiteActionsApi } from './SiteActionsApi';

export class HttpSiteActionsApi implements SiteActionsApi {
  readonly #http: HttpTransport;

  constructor(baseUrl: string, identity: RequestIdentity, fetchImpl?: typeof fetch) {
    this.#http = new HttpTransport(baseUrl, identity, fetchImpl);
  }

  vote(siteId: string, request: VoteRequest): Promise<VoteResult> {
    return this.#http.post<VoteResult>(`/sites/${encodeURIComponent(siteId)}/votes`, request);
  }

  cleanup(siteId: string, request: CleanupRequest): Promise<CleanupAccepted> {
    return this.#http.post<CleanupAccepted>(`/sites/${encodeURIComponent(siteId)}/cleanup`, request);
  }

  letter(siteId: string, request: LetterRequest): Promise<LetterDraft> {
    return this.#http.post<LetterDraft>(`/sites/${encodeURIComponent(siteId)}/letters`, request);
  }
}
