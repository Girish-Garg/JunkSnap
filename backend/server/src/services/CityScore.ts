import type { AreaSite } from "../domain/AreaSite.js";
import type { AreaSites } from "../domain/AreaSites.js";
import type { DataWindow } from "../domain/DataWindow.js";
import { complement, DAY_MS, mean, median, percent } from "../domain/scoreUtils.js";

const CLEAR_WITHIN_DAYS = 7;

export interface CityMeasure {
  readonly medianDaysToClear: number | null;
  readonly clearedWithin7DaysPct: number | null;
  readonly redumpedPct: number | null;
  readonly noBinResponsePct: number | null;
  readonly value: number | null;
}

// scores-v1 and v2 city: how fast and how lastingly the city clears verified sites.
export class CityScore {
  measure(sites: AreaSites, window: DataWindow): CityMeasure {
    const verified = sites.verified();
    const medianDaysToClear = median(verified.map((site) => site.daysToClear(window.toMs)));
    const clearedWithin7DaysPct = this.#clearedWithin7Days(verified, window);
    const redumpedPct = this.#redumped(verified);
    const noBinResponsePct = this.#noBinResponse(verified);
    const speed = medianDaysToClear === null ? null : Math.max(0, 100 - 10 * medianDaysToClear);
    const value = mean([speed, clearedWithin7DaysPct, complement(redumpedPct), noBinResponsePct]);
    return { medianDaysToClear, clearedWithin7DaysPct, redumpedPct, noBinResponsePct, value };
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

  #noBinResponse(verified: readonly AreaSite[]): number | null {
    const noBin = verified.filter((site) => site.isType("no_bin"));
    return percent(noBin.filter((site) => site.everCleared()).length, noBin.length);
  }
}
