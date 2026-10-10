import { UNMEASURED, type BinMeasure } from "../bins/KnownBin.js";
import type { ReportInsights, SiteInsights } from "./SiteTypes.js";

type Source = SiteInsights["hazards"][number]["sources"][number];
type Sources = SiteInsights["hazards"][number]["sources"];
type SizeValue = NonNullable<SiteInsights["size_class"]>["value"];

interface Estimate<K> {
  readonly key: K;
  readonly value: number;
  readonly source: Source;
}

interface Tally {
  readonly total: number;
  readonly reports: number;
  readonly sources: Sources;
}

const SIZE_ORDER: readonly SizeValue[] = ["small", "medium", "large"];
const MAX_MATERIALS = 9;
const ONE_DECIMAL = 10;

// Site insights from its verified reports only (site.schema.json); only measured numbers, each with its models.
export class InsightMerge {
  readonly #reports: readonly ReportInsights[];

  constructor(reports: readonly ReportInsights[]) {
    this.#reports = reports;
  }

  // Places and the nearest bin are measured from the site's point, not from reports, so they are carried over.
  merged(near: SiteInsights["near"], bin: BinMeasure = UNMEASURED): SiteInsights {
    return {
      reports: this.#reports.length,
      composition: this.#composition(),
      size_class: this.#sizeClass(),
      hazards: this.#hazards(),
      near,
      ...bin,
    };
  }

  // Mean share over the merged reports, a missing material counting as 0; largest first.
  #composition(): SiteInsights["composition"] {
    const estimates = this.#reports.flatMap((report) =>
      report.composition.map((entry) => ({ key: entry.material, value: entry.share_pct, source: entry.source })),
    );
    const merged = [...InsightMerge.#tally(estimates)].map(([material, tally]) => ({
      material,
      share_pct: Math.round((tally.total / this.#reports.length) * ONE_DECIMAL) / ONE_DECIMAL,
      reports: tally.reports,
      sources: tally.sources,
    }));
    const largestFirst = merged.sort((a, b) => b.share_pct - a.share_pct);
    return largestFirst.slice(0, MAX_MATERIALS) as SiteInsights["composition"];
  }

  // The most common size class, ties going to the larger.
  #sizeClass(): SiteInsights["size_class"] {
    const estimates = this.#reports.flatMap((report) =>
      report.size_class === null ? [] : [{ key: report.size_class.value, value: 1, source: report.size_class.source }],
    );
    const ranked = [...InsightMerge.#tally(estimates)].sort(
      ([sizeA, a], [sizeB, b]) => b.reports - a.reports || SIZE_ORDER.indexOf(sizeB) - SIZE_ORDER.indexOf(sizeA),
    );
    const top = ranked[0];
    return top === undefined ? null : { value: top[0], reports: top[1].reports, sources: top[1].sources };
  }

  #hazards(): SiteInsights["hazards"] {
    const estimates = this.#reports.flatMap((report) =>
      report.hazards.map((entry) => ({ key: entry.hazard, value: 1, source: entry.source })),
    );
    const merged = [...InsightMerge.#tally(estimates)].map(([hazard, tally]) => ({
      hazard,
      reports: tally.reports,
      sources: tally.sources,
    }));
    return merged.sort((a, b) => b.reports - a.reports) as SiteInsights["hazards"];
  }

  static #tally<K>(estimates: readonly Estimate<K>[]): Map<K, Tally> {
    const tallies = new Map<K, Tally>();
    for (const { key, value, source } of estimates) {
      const kept = tallies.get(key);
      const sources = kept === undefined ? ([source] as Sources) : InsightMerge.#withSource(kept.sources, source);
      tallies.set(key, { total: (kept?.total ?? 0) + value, reports: (kept?.reports ?? 0) + 1, sources });
    }
    return tallies;
  }

  static #withSource(sources: Sources, source: Source): Sources {
    const same = (known: Source) =>
      known.signal === source.signal && known.provider === source.provider && known.model === source.model && known.version === source.version;
    return sources.some(same) ? sources : [...sources, source];
  }
}
