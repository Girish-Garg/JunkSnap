import type { AreaLetterDraft, AreaLetterRequest } from '../domain/AreaLetter';
import type { AreaKind } from '../domain/AreaScores';

/** POST /areas/{kind}/{id}/letters (needs sign-in). 409 not_verified with a reason, 422 no_local_body, 429 rate_limited. */
export interface AreaLetterApi {
  letter(kind: AreaKind, id: string, request: AreaLetterRequest): Promise<AreaLetterDraft>;
}
