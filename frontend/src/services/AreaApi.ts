import type { AreaCrawl } from '../domain/AreaCrawl';
import type { AreaKind, AreaScores } from '../domain/AreaScores';

/** GET /areas/{kind}/{id}/scores and GET /areas/district/{id}/crawl, both open without sign-in. */
export interface AreaApi {
  /** Rejects with ApiError area_not_found when the area has no sites. */
  scores(kind: AreaKind, id: string): Promise<AreaScores>;
  /** Where the district's ward crawl stands; not_started when it has none. */
  crawl(districtId: string): Promise<AreaCrawl>;
}
