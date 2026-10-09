import type { AreaInsights } from "../domain/AreaInsights.js";
import type { AreaSite } from "../domain/AreaSite.js";
import type { DataWindow } from "../domain/DataWindow.js";
import { insightReason, istParts } from "../domain/scoreUtils.js";

const HOURS = 24;
const WEEKDAYS = 7;

// When verified reports were captured, in IST: a pattern, so withheld below the guardrail.
export class ReportTimeInsight {
  hourOfDay(sites: readonly AreaSite[], enough: boolean): AreaInsights["hour_of_day"] {
    const times = sites.flatMap((site) => site.reportTimes());
    const reason = insightReason(enough, times.length > 0);
    const value = reason === null ? ReportTimeInsight.#histogram(times.map((time) => istParts(time).hour), HOURS) : null;
    return { value, reports: times.length, reason };
  }

  // Monday first; no_data until the window spans a full week.
  dayOfWeek(sites: readonly AreaSite[], enough: boolean, window: DataWindow): AreaInsights["day_of_week"] {
    const times = sites.flatMap((site) => site.reportTimes());
    const reason = insightReason(enough, times.length > 0 && window.days() >= WEEKDAYS);
    const value = reason === null ? ReportTimeInsight.#histogram(times.map((time) => istParts(time).weekday), WEEKDAYS) : null;
    return { value, reports: times.length, reason };
  }

  static #histogram(buckets: readonly number[], size: number): number[] {
    const counts = new Array<number>(size).fill(0);
    for (const bucket of buckets) {
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    }
    return counts;
  }
}
