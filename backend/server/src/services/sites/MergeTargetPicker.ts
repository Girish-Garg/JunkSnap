import type { EmbeddingVector } from "../../domain/sites/EmbeddingVector.js";
import { MergeCandidates } from "../../domain/sites/MergeCandidates.js";
import type { MergeableReport } from "../../domain/sites/MergeableReport.js";
import type { Site } from "../../domain/sites/Site.js";
import type { MergeGateRules } from "../../domain/sites/SiteRules.js";
import type { EmbeddingStore } from "../../ports/sites/EmbeddingStore.js";

// The report's own vector, read at most once and only when some candidate has one to compare.
type OwnVector = () => Promise<EmbeddingVector | null>;

// Picks the site a report merges into (decision 20261011-1610-hem-same-spot-merge), in this order: the Me too site when
// it is at the same spot or its photo matches; else the nearest site of the type at the same spot, whatever the photos;
// else the scan spot's own site; else the nearest site whose photo matches.
export class MergeTargetPicker {
  readonly #embeddings: EmbeddingStore;
  readonly #rules: MergeGateRules;

  // mergeMinCosine: MERGE_MIN_COSINE; at 0.88 SigLIP 2 vectors keep 95% of second shots of one pile and let 15% of other
  // piles through (docs/ml/eval.md), so two angles of one dump can miss it: siteSameSpotM catches those.
  constructor(embeddings: EmbeddingStore, rules: MergeGateRules) {
    this.#embeddings = embeddings;
    this.#rules = rules;
  }

  async pick(report: MergeableReport, nearby: readonly Site[]): Promise<Site | null> {
    const candidates = new MergeCandidates(report, nearby, this.#rules.siteSameSpotM);
    const own = this.#ownVector(report, candidates.open());
    const meToo = candidates.meToo();
    if (meToo !== null && (candidates.atSameSpot(meToo) || (await this.#looksAlike(await own(), meToo, report.longRange)))) {
      return meToo;
    }
    return candidates.sameSpot() ?? candidates.spotSite() ?? (await this.#firstAlike(candidates.others(), own, report.longRange));
  }

  async #firstAlike(sites: readonly Site[], own: OwnVector, longRange: boolean): Promise<Site | null> {
    for (const site of sites) {
      if (await this.#looksAlike(await own(), site, longRange)) {
        return site;
      }
    }
    return null;
  }

  #ownVector(report: MergeableReport, candidates: readonly Site[]): OwnVector {
    const key = report.embeddingKey;
    const anyToCompare = candidates.some((site) => site.embeddingKey !== null);
    let read: Promise<EmbeddingVector | null> | undefined;
    return () => (read ??= key !== null && anyToCompare ? this.#embeddings.vectorAt(key) : Promise.resolve(null));
  }

  // Compared only when both sides have a stored embedding. A long-range pin can be dropped anywhere within 500 m,
  // so it joins a site only on a matching photo; without both embeddings it founds its own (decision 20261011-0400).
  async #looksAlike(own: EmbeddingVector | null, site: Site, longRange: boolean): Promise<boolean> {
    if (own === null || site.embeddingKey === null) {
      return !longRange;
    }
    const similarity = own.cosine(await this.#embeddings.vectorAt(site.embeddingKey));
    return similarity !== null && similarity >= this.#rules.mergeMinCosine;
  }
}
