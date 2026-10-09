import type { AreaInsights, InsightSource, Material, MaterialShare } from "../domain/AreaInsights.js";
import type { AreaSite } from "../domain/AreaSite.js";
import type { CompositionEstimate } from "../domain/SiteInsights.js";
import { insightReason, rounded, sum } from "../domain/scoreUtils.js";

// Mean share per material over the area's verified reports: each site's mean weighted by its report count.
export class CompositionInsight {
  measure(sites: readonly AreaSite[], enough: boolean): AreaInsights["composition"] {
    const estimates = sites.map((site) => site.compositionEstimate()).filter((estimate) => estimate !== null);
    const reports = sum(estimates.map((estimate) => estimate.reports));
    const reason = insightReason(enough, reports > 0);
    if (reason !== null) {
      return { value: null, reports, sources: [], reason };
    }
    const value = CompositionInsight.#shares(estimates, reports);
    return { value, reports, sources: CompositionInsight.#sources(estimates), reason };
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

  // Each distinct model behind the merged estimates, in a stable order.
  static #sources(estimates: readonly CompositionEstimate[]): InsightSource[] {
    const all = estimates.flatMap((estimate) => estimate.shares.flatMap((share) => share.sources));
    const key = (source: InsightSource) => JSON.stringify([source.signal, source.provider, source.model, source.version]);
    const distinct = new Map(all.map((source) => [key(source), source] as const));
    return [...distinct].sort(([a], [b]) => a.localeCompare(b)).map(([, source]) => ({ ...source }));
  }
}
