import type { EmbeddingVector } from "../../domain/sites/EmbeddingVector.js";
import type { MergeableReport } from "../../domain/sites/MergeableReport.js";
import type { Site } from "../../domain/sites/Site.js";
import type { EmbeddingStore } from "../../ports/sites/EmbeddingStore.js";

// Not yet measured on real photos (docs/decisions/20261010-0253-hem-verified-count.md).
export const DEFAULT_MIN_COSINE = 0.75;
const ME_TOO_RANK = -1;

// Picks the site a report merges into: the Me too site when it qualifies, else the nearest that does.
export class MergeTargetPicker {
  readonly #embeddings: EmbeddingStore;
  readonly #minCosine: number;

  constructor(embeddings: EmbeddingStore, minCosine: number = DEFAULT_MIN_COSINE) {
    this.#embeddings = embeddings;
    this.#minCosine = minCosine;
  }

  async pick(report: MergeableReport, nearby: readonly Site[]): Promise<Site | null> {
    const rank = (site: Site): number =>
      site.siteId === report.meTooSiteId ? ME_TOO_RANK : site.point.distanceTo(report.point);
    const candidates = nearby.filter((site) => site.accepts(report)).sort((a, b) => rank(a) - rank(b));
    const own = await this.#reportVector(report, candidates);
    for (const site of candidates) {
      if (await this.#looksAlike(own, site)) {
        return site;
      }
    }
    return null;
  }

  async #reportVector(report: MergeableReport, candidates: readonly Site[]): Promise<EmbeddingVector | null> {
    const anyToCompare = candidates.some((site) => site.embeddingKey !== null);
    return report.embeddingKey !== null && anyToCompare ? this.#embeddings.vectorAt(report.embeddingKey) : null;
  }

  // Compared only when both sides have a stored embedding.
  async #looksAlike(own: EmbeddingVector | null, site: Site): Promise<boolean> {
    if (own === null || site.embeddingKey === null) {
      return true;
    }
    const theirs = await this.#embeddings.vectorAt(site.embeddingKey);
    return own.cosine(theirs) >= this.#minCosine;
  }
}
