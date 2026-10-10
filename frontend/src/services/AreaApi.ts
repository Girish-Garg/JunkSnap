import type { AreaKind, AreaScores } from '../domain/AreaScores';

/** GET /areas/{kind}/{id}/scores, open without sign-in. */
export interface AreaApi {
  /** Rejects with ApiError area_not_found when the area has no sites. */
  scores(kind: AreaKind, id: string): Promise<AreaScores>;
}
