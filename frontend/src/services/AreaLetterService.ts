import type { AreaIssue, AreaLetterDraft } from '../domain/AreaLetter';
import type { AreaKind } from '../domain/AreaScores';
import type { LetterLanguage } from '../domain/SiteActions';
import type { AreaLetterApi } from './AreaLetterApi';
import type { RequestIdentity } from './ReportApi';
import { SignedInStep } from './SignedInStep';

/** Letters about a whole area need a signed-in user, like site letters. */
export class AreaLetterService {
  readonly #api: AreaLetterApi;
  readonly #identity: RequestIdentity;
  readonly #signedIn: SignedInStep;

  constructor(api: AreaLetterApi, identity: RequestIdentity) {
    this.#api = api;
    this.#identity = identity;
    this.#signedIn = new SignedInStep(identity);
  }

  async letter(area: { readonly kind: AreaKind; readonly id: string }, issue: AreaIssue, language: LetterLanguage): Promise<AreaLetterDraft> {
    const device_token = await this.#identity.deviceToken();
    return this.#signedIn.run(() => this.#api.letter(area.kind, area.id, { issue, language, device_token }));
  }
}
