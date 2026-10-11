import type { EmbeddingVector } from "../../domain/sites/EmbeddingVector.js";
import type { MergeableReport } from "../../domain/sites/MergeableReport.js";
import type { Site } from "../../domain/sites/Site.js";
import type { EmbeddingStore } from "../../ports/sites/EmbeddingStore.js";

const ME_TOO_RANK = -1;

// Picks the site a report merges into: the Me too site when it qualifies, else the nearest that does.
export class MergeTargetPicker {
  readonly #embeddings: EmbeddingStore;
  readonly #minCosine: number;

  // minCosine: MERGE_MIN_COSINE; at 0.88 SigLIP 2 vectors keep 95% of second shots of one pile and let 15% of other
  // piles through (docs/ml/eval.md).
  constructor(embeddings: EmbeddingStore, minCosine: number) {
    this.#embeddings = embeddings;
    this.#minCosine = minCosine;
  }

  async pick(report: MergeableReport, nearby: readonly Site[]): Promise<Site | null> {
    const rank = (site: Site): number =>
      site.siteId === report.meTooSiteId ? ME_TOO_RANK : site.point.distanceTo(report.point);
    const candidates = nearby.filter((site) => site.accepts(report)).sort((a, b) => rank(a) - rank(b));
    // Frames of one scan spot always join their spot's site; views of one place differ too much for the embedding test.
    const spotSite = candidates.find((site) => site.siteId === report.spotSiteId);
    if (spotSite !== undefined) {
      return spotSite;
    }
    const own = await this.#reportVector(report, candidates);
    for (const site of candidates) {
      if (await this.#looksAlike(own, site, report.longRange)) {
        return site;
      }
    }
    return null;
  }

  async #reportVector(report: MergeableReport, candidates: readonly Site[]): Promise<EmbeddingVector | null> {
    const anyToCompare = candidates.some((site) => site.embeddingKey !== null);
    return report.embeddingKey !== null && anyToCompare ? this.#embeddings.vectorAt(report.embeddingKey) : null;
  }

  // Compared only when both sides have a stored embedding. A long-range pin can be dropped anywhere within 500 m,
  // so it joins a site only on a matching photo; without both embeddings it founds its own (decision 20261011-0400).
  async #looksAlike(own: EmbeddingVector | null, site: Site, longRange: boolean): Promise<boolean> {
    if (own === null || site.embeddingKey === null) {
      return !longRange;
    }
    const similarity = own.cosine(await this.#embeddings.vectorAt(site.embeddingKey));
    return similarity !== null && similarity >= this.#minCosine;
  }
}
