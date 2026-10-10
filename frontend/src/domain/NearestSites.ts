import { BBox } from './BBox';
import type { LonLat, SiteFeature } from './Site';
import { SiteListing } from './SiteListing';

// One GET /sites query: up to 1 by 1 degree (contracts/README.md), about 100 km around the view's centre.
const REACH_DEG = 0.99;
// Sites nearly as near as the nearest one join it, so a fit shows a small cluster rather than one pin.
const CLUSTER_FACTOR = 2;
const MAX_SITES = 3;

/** The sites just off an empty view: where to look, which are nearest, and the view that shows them too. */
export class NearestSites {
  /** The box to search around an empty view, or null when the view already spans one query (the list mode box). */
  static reach(view: BBox): BBox | null {
    return view.isWiderThan(REACH_DEG - 1e-6) ? null : BBox.around(view.center(), REACH_DEG);
  }

  /** The nearest site on the active map, plus up to two more nearly as near; empty when there are none. */
  static of(sites: readonly SiteFeature[], from: LonLat): readonly SiteFeature[] {
    const ranked = sites
      .filter((site) => SiteListing.onMap(site.properties))
      .map((site) => ({ site, distance: NearestSites.distance(from, site.geometry.coordinates) }))
      .sort((a, b) => a.distance - b.distance);
    const nearest = ranked[0]?.distance ?? 0;
    return ranked
      .filter(({ distance }) => distance <= nearest * CLUSTER_FACTOR)
      .slice(0, MAX_SITES)
      .map(({ site }) => site);
  }

  /**
   * Points that frame the view's middle and these sites. The sites lie outside the view, so the map keeps the
   * city in sight and widens only as far as it must, which leaves nearby pins at a zoom where they still show.
   */
  static frame(view: BBox, sites: readonly SiteFeature[]): readonly LonLat[] {
    return [view.center(), ...sites.map((site) => site.geometry.coordinates)];
  }

  /** Approximate ground distance in degrees of latitude; enough to rank sites a city apart. */
  static distance([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
    const dx = (lon2 - lon1) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
    return Math.hypot(dx, lat2 - lat1);
  }
}
