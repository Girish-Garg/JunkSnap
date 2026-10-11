import { NearestSites } from './NearestSites';
import type { LonLat, SiteFeature } from './Site';

/** How the site list is ordered; "confirm" (Needs confirming) is a quick sort beside these three. */
export const SITE_SORTS = ['nearest', 'newest', 'backed'] as const;
export type SiteSort = (typeof SITE_SORTS)[number] | 'confirm';

type Compare = (a: SiteFeature, b: SiteFeature) => number;

const newest: Compare = (a, b) => b.properties.last_reported_at.localeCompare(a.properties.last_reported_at);
// Ties keep one fixed order, so the list and the preview's next and previous never shuffle between renders.
const byId: Compare = (a, b) => a.properties.site_id.localeCompare(b.properties.site_id);

/** The site list's order: nearest to a point, newest report first, or the most people backing it first. */
export class SiteOrder {
  /** Nearest when the person's location is known; otherwise newest, since "near the map's middle" means little. */
  static defaultFor(located: boolean): SiteSort {
    return located ? 'nearest' : 'newest';
  }

  /** A new sorted array; `from` is where "nearest" measures from. */
  static sort(sites: readonly SiteFeature[], sort: SiteSort, from: LonLat): readonly SiteFeature[] {
    const compare = SiteOrder.#compare(sort, from);
    return [...sites].sort((a, b) => compare(a, b) || newest(a, b) || byId(a, b));
  }

  /** Still waiting for people to back it (unverified), so someone nearby can help confirm it. */
  static waiting(site: SiteFeature): boolean {
    return site.properties.verification === 'unverified';
  }

  static #compare(sort: SiteSort, from: LonLat): Compare {
    const nearest: Compare = (a, b) => NearestSites.distance(from, a.geometry.coordinates) - NearestSites.distance(from, b.geometry.coordinates);
    if (sort === 'newest') return newest;
    if (sort === 'backed') return (a, b) => b.properties.backers.count - a.properties.backers.count;
    // Needs confirming: the waiting sites first, each group nearest first.
    if (sort === 'confirm') return (a, b) => Number(SiteOrder.waiting(b)) - Number(SiteOrder.waiting(a)) || nearest(a, b);
    return nearest;
  }
}
