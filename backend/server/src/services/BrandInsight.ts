import type { AreaInsights, BrandCount } from "../domain/AreaInsights.js";
import type { AreaSite } from "../domain/AreaSite.js";
import type { BrandSighting } from "../domain/SiteInsights.js";

const TOP_BRANDS = 5;

interface Tally {
  readonly brand: string;
  readonly parentCompany: string;
  readonly sites: Set<string>;
  labels: number;
}

// Counts readable labels only (confidence 0.8 or more); a count, so it shows below the guardrail too.
export class BrandInsight {
  measure(sites: readonly AreaSite[]): AreaInsights["top_brands"] {
    const sightings = sites.flatMap((site) => site.readableBrands().map((label) => ({ siteId: site.id, label })));
    const tallies = new Map<string, Tally>();
    for (const { siteId, label } of sightings) {
      const key = JSON.stringify([label.brand, label.parentCompany]);
      const tally = tallies.get(key) ?? BrandInsight.#emptyTally(label);
      tally.sites.add(siteId);
      tally.labels += 1;
      tallies.set(key, tally);
    }
    return { value: BrandInsight.#top([...tallies.values()]), labels: sightings.length, reason: null };
  }

  static #emptyTally(label: BrandSighting): Tally {
    return { brand: label.brand, parentCompany: label.parentCompany, sites: new Set(), labels: 0 };
  }

  static #top(tallies: readonly Tally[]): BrandCount[] {
    const counts = tallies.map((tally) => ({
      brand: tally.brand,
      parent_company: tally.parentCompany,
      sites: tally.sites.size,
      labels: tally.labels,
    }));
    counts.sort((a, b) => b.labels - a.labels || b.sites - a.sites || a.brand.localeCompare(b.brand));
    return counts.slice(0, TOP_BRANDS);
  }
}
