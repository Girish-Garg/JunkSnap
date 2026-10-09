import type { AreaFactSheet } from "../domain/AreaFactSheet.js";
import type { AreaInsights } from "../domain/AreaInsights.js";
import type { AreaSites } from "../domain/AreaSites.js";
import type { DataWindow } from "../domain/DataWindow.js";
import { BrandInsight } from "./BrandInsight.js";
import { CompositionInsight } from "./CompositionInsight.js";
import { HazardInsight } from "./HazardInsight.js";
import { NearPlacesInsight } from "./NearPlacesInsight.js";
import { RepeatSpotInsight } from "./RepeatSpotInsight.js";
import { ReportTimeInsight } from "./ReportTimeInsight.js";

export interface InsightInput {
  readonly sites: AreaSites;
  readonly window: DataWindow;
  readonly facts: AreaFactSheet;
  // At least min_verified_reports; shares and patterns are withheld otherwise.
  readonly enough: boolean;
}

export interface InsightParts {
  readonly composition: CompositionInsight;
  readonly hazards: HazardInsight;
  readonly brands: BrandInsight;
  readonly repeats: RepeatSpotInsight;
  readonly times: ReportTimeInsight;
  readonly near: NearPlacesInsight;
}

// Area insights (decision 20261010-0202) over the verified sites that hold verified reports.
export class AreaInsightsBuilder {
  readonly #parts: InsightParts;

  constructor(parts: InsightParts) {
    this.#parts = parts;
  }

  static standard(): AreaInsightsBuilder {
    return new AreaInsightsBuilder({
      composition: new CompositionInsight(),
      hazards: new HazardInsight(),
      brands: new BrandInsight(),
      repeats: new RepeatSpotInsight(),
      times: new ReportTimeInsight(),
      near: new NearPlacesInsight(),
    });
  }

  build({ sites, window, facts, enough }: InsightInput): AreaInsights {
    const scope = sites.withVerifiedReports();
    const parts = this.#parts;
    return {
      composition: parts.composition.measure(scope, enough),
      hazardous_share_pct: parts.hazards.measure(scope, enough),
      top_brands: parts.brands.measure(scope),
      repeat_spots: parts.repeats.measure(scope),
      hour_of_day: parts.times.hourOfDay(scope, enough),
      day_of_week: parts.times.dayOfWeek(scope, enough, window),
      near_school_or_water_count: parts.near.measure(scope, facts.placesMapped),
    };
  }
}
