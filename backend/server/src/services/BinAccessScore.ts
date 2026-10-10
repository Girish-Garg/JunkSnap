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

// scores-v3 bin access (decision 20261010-1630): the share of the area's verified sites that are verified no-bin zones
// (10 people each), and the measured distance to known bins. no_bin_within_3km_pct stays a shown measure only.
// overflowing_bin sites stand at a bin, so they would make an area look well served: never measured (decision 20261010-1645).
export class BinAccessScore {
  measure(sites: AreaSites): BinAccessMeasure {
    const verified = sites.verified().filter((site) => !site.isType("overflowing_bin"));
    const measured = verified.filter((site) => site.binMeasured());
    const noBinWithin3kmPct = percent(measured.filter((site) => site.noBinNearby()).length, measured.length);
    const zoneSharePct = percent(verified.filter((site) => site.isType("no_bin")).length, verified.length);
    const medianDistanceToBinM = median(verified.flatMap(BinAccessScore.#distance));
    const distancePart = medianDistanceToBinM === null ? null : Math.max(0, 100 - medianDistanceToBinM / METRES_PER_POINT);
    return { medianDistanceToBinM, noBinWithin3kmPct, value: mean([complement(zoneSharePct), distancePart]) };
  }

  static #distance(site: AreaSite): number[] {
    const distance = site.nearestBinM();
    return distance === null ? [] : [distance];
  }
}
