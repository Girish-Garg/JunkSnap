import type { AreaSite } from "../domain/AreaSite.js";
import type { AreaSites } from "../domain/AreaSites.js";
import { complement, mean, median, percent } from "../domain/scoreUtils.js";

// 3 km, the no-bin radius, scores 0.
const METRES_PER_POINT = 30;

export interface BinAccessMeasure {
  readonly medianDistanceToBinM: number | null;
  readonly noBinWithin3kmPct: number | null;
  readonly value: number | null;
}

// scores-v2 bin access: measured from known bins, never from no_bin report counts (decision 20261010-1430).
export class BinAccessScore {
  measure(sites: AreaSites): BinAccessMeasure {
    const verified = sites.verified();
    const measured = verified.filter((site) => site.binMeasured());
    const noBinWithin3kmPct = percent(measured.filter((site) => site.noBinNearby()).length, measured.length);
    const medianDistanceToBinM = median(verified.flatMap(BinAccessScore.#distance));
    const distancePart = medianDistanceToBinM === null ? null : Math.max(0, 100 - medianDistanceToBinM / METRES_PER_POINT);
    return { medianDistanceToBinM, noBinWithin3kmPct, value: mean([complement(noBinWithin3kmPct), distancePart]) };
  }

  static #distance(site: AreaSite): number[] {
    const distance = site.nearestBinM();
    return distance === null ? [] : [distance];
  }
}
