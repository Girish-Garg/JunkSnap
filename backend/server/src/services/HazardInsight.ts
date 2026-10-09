import type { AreaInsights } from "../domain/AreaInsights.js";
import type { AreaSite } from "../domain/AreaSite.js";
import { insightReason, percent, rounded } from "../domain/scoreUtils.js";

// Share of sites with burning or any hazard in site insights; no_data until some site carries insights.
export class HazardInsight {
  measure(sites: readonly AreaSite[], enough: boolean): AreaInsights["hazardous_share_pct"] {
    const hazardous = sites.filter((site) => site.hasHazard()).length;
    const reason = insightReason(enough, sites.some((site) => site.hasInsights()));
    const value = reason === null ? rounded(percent(hazardous, sites.length), 1) : null;
    return { value, hazardous_sites: hazardous, sites: sites.length, reason };
  }
}
