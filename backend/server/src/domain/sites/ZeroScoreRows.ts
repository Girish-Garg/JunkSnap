import type { WardScores } from "../../contracts/index.gen.js";
import type { SiteFeature } from "./SiteTypes.js";

type AreaKind = WardScores["area"]["kind"];
type AreaField = "ward" | "assembly_seat" | "loksabha_seat" | "district";

const AREA_FIELDS: readonly (readonly [AreaKind, AreaField])[] = [
  ["ward", "ward"],
  ["assembly", "assembly_seat"],
  ["loksabha", "loksabha_seat"],
  ["district", "district"],
];
const MIN_VERIFIED_REPORTS = 10;
const FORMULA_VERSION = "scores-v1";

// First scores row for each area of a new site: zero counts, every score withheld (contracts/README.md).
export class ZeroScoreRows {
  readonly #feature: SiteFeature;

  constructor(feature: SiteFeature) {
    this.#feature = feature;
  }

  rows(computedAt: string): WardScores[] {
    const location = this.#feature.properties.location;
    return AREA_FIELDS.flatMap(([kind, field]) => {
      const area = location[field];
      return area ? [this.#row({ kind, id: area.id, name: area.name }, computedAt)] : [];
    });
  }

  // The scores rows' within ids: the site's district and, when it has one, its local body.
  within(): string[] {
    const { district, local_body } = this.#feature.properties.location;
    return local_body === null ? [district.id] : [district.id, local_body.id];
  }

  #row(area: WardScores["area"], computedAt: string): WardScores {
    const withheld = { value: null, reason: "too_few_reports" } as const;
    const { pilot, first_reported_at } = this.#feature.properties;
    return {
      area,
      counts: { verified_reports: 0, no_bin_reports: 0, sites: 0, open_sites: 0, cleaned_sites: 0, reopened_sites: 0 },
      min_verified_reports: MIN_VERIFIED_REPORTS,
      scores: { city: withheld, citizen: withheld, bin_access: withheld },
      metrics: {
        median_days_to_clear: null,
        cleared_within_7_days_pct: null,
        redumped_pct: null,
        no_bin_response_pct: null,
        new_dumps_per_km2_month: null,
        share_vacant_plot_drain_roadside_pct: null,
        median_distance_to_disposal_m: null,
      },
      diagnosis: [],
      formula_version: FORMULA_VERSION,
      pilot,
      data_window: { from: first_reported_at, to: computedAt },
      computed_at: computedAt,
    };
  }
}
