import type { AreaListing } from '../domain/AreaListing';
import type { AreaKind } from '../domain/AreaScores';
import type { AreaApi } from './AreaApi';
import type { Tagged } from './ExpiringCache';

/** An AreaApi whose listing carries its freshness token, so a cache can ask whether its copy changed. */
export interface TaggedAreaApi extends AreaApi {
  /** list() with the copy in hand; the live api sends its ETag and keeps the copy on a 304. */
  listTagged(kind: AreaKind, within: string, limit: number, previous: Tagged<AreaListing> | null): Promise<Tagged<AreaListing>>;
}
