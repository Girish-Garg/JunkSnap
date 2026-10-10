import type { AreaListing } from '../domain/AreaListing';
import type { AreaKind, AreaScores } from '../domain/AreaScores';

/** GET /areas/{kind}/{id}/scores and GET /areas/{kind}?within, both open without sign-in. */
export interface AreaApi {
  /** Rejects with ApiError area_not_found when the area has no sites. */
  scores(kind: AreaKind, id: string): Promise<AreaScores>;
  /** Every area of this kind with sites in the district or city, as its scores row. */
  list(kind: AreaKind, within: string, limit: number): Promise<AreaListing>;
}
