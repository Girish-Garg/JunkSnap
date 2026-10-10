import type { AreaLetterDraft, AreaLetterRequest } from '../domain/AreaLetter';
import type { AreaKind } from '../domain/AreaScores';
import type { AreaLetterApi } from './AreaLetterApi';
import { HttpTransport } from './HttpTransport';
import type { RequestIdentity } from './ReportApi';

export class HttpAreaLetterApi implements AreaLetterApi {
  readonly #http: HttpTransport;

  constructor(baseUrl: string, identity: RequestIdentity, fetchImpl?: typeof fetch) {
    this.#http = new HttpTransport(baseUrl, identity, fetchImpl);
  }

  letter(kind: AreaKind, id: string, request: AreaLetterRequest): Promise<AreaLetterDraft> {
    return this.#http.post<AreaLetterDraft>(`/areas/${kind}/${encodeURIComponent(id)}/letters`, request);
  }
}
