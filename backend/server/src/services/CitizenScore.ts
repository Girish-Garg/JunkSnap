import type { AreaSite } from "../domain/AreaSite.js";
import type { AreaSites } from "../domain/AreaSites.js";
import type { DataWindow } from "../domain/DataWindow.js";
import { complement, mean, percent, sum } from "../domain/scoreUtils.js";

const OPEN_GROUND_CONTEXTS: ReadonlySet<string> = new Set(["vacant_plot", "drain", "roadside"]);
const DAYS_PER_MONTH = 30;

export interface CitizenInput {
  readonly sites: AreaSites;
  readonly window: DataWindow;
  readonly areaKm2: number | null;
  readonly redumpedPct: number | null;
}

export interface CitizenMeasure {
  readonly newDumpsPerKm2Month: number | null;
  readonly shareVacantPlotDrainRoadsidePct: number | null;
  // Before the bin access adjustment.
  readonly raw: number | null;
}

// scores-v1 citizen: new dumping per km² and month, dumping on open ground, re-dumping.
export class CitizenScore {
  measure({ sites, window, areaKm2, redumpedPct }: CitizenInput): CitizenMeasure {
    const dumps = sites.verified().filter((site) => site.isType("waste_dump"));
    const share = this.#shareOnOpenGround(dumps);
    if (areaKm2 === null) {
      return { newDumpsPerKm2Month: null, shareVacantPlotDrainRoadsidePct: share, raw: null };
    }
    const months = Math.max(window.days(), 1) / DAYS_PER_MONTH;
    const newDumps = dumps.length / areaKm2 / months;
    const raw = mean([Math.max(0, 100 - 5 * newDumps), complement(share), complement(redumpedPct)]);
    return { newDumpsPerKm2Month: newDumps, shareVacantPlotDrainRoadsidePct: share, raw };
  }

  // Poor bin access moves the score up to half way towards 100: people with nowhere to put waste are judged less.
  adjust(raw: number | null, binAccess: number | null): number | null {
    if (raw === null || binAccess === null) {
      return raw;
    }
    return raw + ((100 - raw) * (100 - binAccess)) / 200;
  }

  #shareOnOpenGround(dumps: readonly AreaSite[]): number | null {
    const openGround = dumps.filter((site) => site.inContext(OPEN_GROUND_CONTEXTS));
    const reports = (sites: readonly AreaSite[]) => sum(sites.map((site) => site.verifiedReports()));
    return percent(reports(openGround), reports(dumps));
  }
}
