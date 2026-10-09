import type { AreaInsights } from "../domain/AreaInsights.js";
import type { AreaSite } from "../domain/AreaSite.js";
import type { PlaceKind, SensitivePlace } from "../domain/SensitivePlace.js";

const SCHOOL_OR_WATER: ReadonlySet<PlaceKind> = new Set(["school", "water_body", "open_drain"]);

// Sites within 100 m of a school, water body or open drain; no_data when nothing was crawled for the area.
export class NearPlacesInsight {
  measure(sites: readonly AreaSite[], places: readonly SensitivePlace[]): AreaInsights["near_school_or_water_count"] {
    const crawled = places.length > 0 || sites.some((site) => site.hasNearbyPlaces());
    if (!crawled) {
      return { value: null, sites: sites.length, reason: "no_data" };
    }
    const near = sites.filter((site) => site.isNear(SCHOOL_OR_WATER, places)).length;
    return { value: near, sites: sites.length, reason: null };
  }
}
