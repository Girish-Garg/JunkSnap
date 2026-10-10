import type { LetterDraft } from "../../contracts/index.gen.js";
import type { LetterSite, SiteInsights } from "./LetterSite.js";

type Evidence = LetterDraft["evidence"];

// The nearest bin matters for these types only.
const BIN_TYPES: ReadonlySet<string> = new Set(["waste_dump", "no_bin"]);

// What a letter rests on, for the app to show and print beside it.
export class LetterEvidence {
  readonly #site: LetterSite;

  constructor(site: LetterSite) {
    this.#site = site;
  }

  section(): Evidence {
    const facts = this.#site.evidence;
    const withBin = BIN_TYPES.has(this.#site.reportType);
    const bin = withBin ? facts.nearestBin : null;
    return {
      report_count: facts.reportCount,
      reporters: facts.reporters,
      verified_count: facts.verifiedCount,
      first_reported_at: facts.firstReportedAt,
      last_reported_at: facts.lastReportedAt,
      photo_urls: facts.photoUrls,
      insights: facts.insights === null ? null : LetterEvidence.#insights(facts.insights),
      nearest_bin: bin === null ? null : { distance_m: bin.distance_m, ref: bin.ref, source_url: bin.source.source_url },
      no_bin_within_3km: withBin ? facts.noBinWithin3km : null,
    };
  }

  static #insights(insights: SiteInsights): NonNullable<Evidence["insights"]> {
    return {
      reports: insights.reports,
      composition: insights.composition.map(({ material, share_pct, reports }) => ({ material, share_pct, reports })),
      size_class: insights.size_class?.value ?? null,
      hazards: insights.hazards.map((entry) => entry.hazard),
      near: insights.near.map(({ kind, distance_m }) => ({ kind, distance_m })),
    };
  }
}
