import type { LonLat, SiteFeature } from './Site';
import { metresBetween } from './utils';

/** How far the person is from a site; null without a location fix or with a broken one, never NaN. */
export class SiteDistance {
  static metres(site: SiteFeature, from: LonLat | null): number | null {
    if (!from) return null;
    const metres = metresBetween(from, site.geometry.coordinates);
    return Number.isFinite(metres) ? metres : null;
  }
}
