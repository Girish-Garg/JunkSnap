import type { AreaInsights } from "../domain/AreaInsights.js";
import type { AreaSite } from "../domain/AreaSite.js";
import type { PlaceKind } from "../domain/SiteInsights.js";

const SCHOOL_OR_WATER: ReadonlySet<PlaceKind> = new Set(["school", "water"]);

// Sites with a school or water body in site.insights.near; no_data when the city has no crawled map layers.
export class NearPlacesInsight {
  measure(sites: readonly AreaSite[], placesMapped: boolean): AreaInsights["near_school_or_water_count"] {
    const mapped = placesMapped || sites.some((site) => site.hasNearbyPlaces());
    if (!mapped) {
      return { value: null, sites: sites.length, reason: "no_data" };
    }
    const near = sites.filter((site) => site.isNear(SCHOOL_OR_WATER)).length;
    return { value: near, sites: sites.length, reason: null };
  }
}
