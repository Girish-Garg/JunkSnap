import type { AreaSite, ReportType } from "../domain/AreaSite.js";
import type { AreaSites } from "../domain/AreaSites.js";
import type { DataWindow } from "../domain/DataWindow.js";
import { complement, DAY_MS, mean, median, percent } from "../domain/scoreUtils.js";

// Fixed by the metric's name in the ward_scores contract (cleared_within_7_days_pct).
const CLEAR_WITHIN_DAYS = 7;

export interface CityMeasure {
  readonly medianDaysToClear: number | null;
  readonly clearedWithin7DaysPct: number | null;
  readonly redumpedPct: number | null;
  readonly noBinResponsePct: number | null;
  readonly binServicePct: number | null;
  readonly value: number | null;
}

// scores-v3 city: how fast and how lastingly the city clears verified sites, and whether it services bad-state bins.
export class CityScore {
  readonly #minBinServiceSites: number;

  // Bin service needs MIN_BIN_SERVICE_SITES verified overflowing_bin sites, so one bin never sways the score (decision 20261010-1645).
  constructor(minBinServiceSites: number) {
    this.#minBinServiceSites = minBinServiceSites;
  }

  measure(sites: AreaSites, window: DataWindow): CityMeasure {
    const verified = sites.verified();
    const medianDaysToClear = median(verified.map((site) => site.daysToClear(window.toMs)));
    const clearedWithin7DaysPct = this.#clearedWithin7Days(verified, window);
    const redumpedPct = this.#redumped(verified);
    const noBinResponsePct = CityScore.#clearedShare(verified, "no_bin");
    const binServicePct = this.#binService(verified);
    const speed = medianDaysToClear === null ? null : Math.max(0, 100 - 10 * medianDaysToClear);
    const value = mean([speed, clearedWithin7DaysPct, complement(redumpedPct), noBinResponsePct, binServicePct]);
    return { medianDaysToClear, clearedWithin7DaysPct, redumpedPct, noBinResponsePct, binServicePct, value };
  }

  #redumped(verified: readonly AreaSite[]): number | null {
    const cleared = verified.filter((site) => site.everCleared());
    return percent(cleared.filter((site) => site.hasStatus("reopened")).length, cleared.length);
  }

  // Only sites reported at least 7 days before the window ends have had 7 days to clear.
  #clearedWithin7Days(verified: readonly AreaSite[], window: DataWindow): number | null {
    const due = verified.filter((site) => site.reportedBy(window.toMs - CLEAR_WITHIN_DAYS * DAY_MS));
    return percent(due.filter((site) => site.clearedWithinDays(CLEAR_WITHIN_DAYS)).length, due.length);
  }

  // Null below MIN_BIN_SERVICE_SITES, so it feeds neither the mean nor the city_response diagnosis.
  #binService(verified: readonly AreaSite[]): number | null {
    const bins = verified.filter((site) => site.isType("overflowing_bin")).length;
    return bins < this.#minBinServiceSites ? null : CityScore.#clearedShare(verified, "overflowing_bin");
  }

  // no_bin response and bin service: sites of one type ever cleared or served, over all of them.
  static #clearedShare(verified: readonly AreaSite[], reportType: ReportType): number | null {
    const ofType = verified.filter((site) => site.isType(reportType));
    return percent(ofType.filter((site) => site.everCleared()).length, ofType.length);
  }
}
