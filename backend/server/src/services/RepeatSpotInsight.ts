import type { AreaInsights } from "../domain/AreaInsights.js";
import type { AreaSite } from "../domain/AreaSite.js";

const LISTED_SPOTS = 10;

// Reopened after a cleanup, or reported on 2 or more IST days; a count, so it shows below the guardrail too.
export class RepeatSpotInsight {
  measure(sites: readonly AreaSite[]): AreaInsights["repeat_spots"] {
    const spots = sites.filter((site) => site.isRepeatSpot());
    spots.sort((a, b) => b.verifiedReports() - a.verifiedReports() || a.id.localeCompare(b.id));
    return { value: spots.slice(0, LISTED_SPOTS).map((site) => site.id), count: spots.length, reason: null };
  }
}
