import type { AreaInsights, Material, MaterialShare } from "../domain/AreaInsights.js";
import type { AreaSite } from "../domain/AreaSite.js";
import type { CompositionEstimate } from "../domain/SiteInsights.js";
import { insightReason, rounded, sum } from "../domain/scoreUtils.js";

// Mean share per material over the area's verified reports: each site's mean weighted by its report count.
export class CompositionInsight {
  measure(sites: readonly AreaSite[], enough: boolean): AreaInsights["composition"] {
    const estimates = sites.map((site) => site.compositionEstimate()).filter((estimate) => estimate !== null);
    const reports = sum(estimates.map((estimate) => estimate.reports));
    const reason = insightReason(enough, reports > 0);
    return { value: reason === null ? CompositionInsight.#shares(estimates, reports) : null, reports, reason };
  }

  static #shares(estimates: readonly CompositionEstimate[], reports: number): MaterialShare[] {
    const weighted = new Map<Material, number>();
    for (const estimate of estimates) {
      for (const { material, share_pct } of estimate.shares) {
        weighted.set(material, (weighted.get(material) ?? 0) + share_pct * estimate.reports);
      }
    }
    const shares = [...weighted].map(([material, total]) => ({ material, share_pct: rounded(total / reports, 1) ?? 0 }));
    return shares.sort((a, b) => b.share_pct - a.share_pct || a.material.localeCompare(b.material));
  }
}
