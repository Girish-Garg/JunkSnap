import type { AreaSites } from "../domain/AreaSites.js";
import type { GeoPoint } from "../domain/GeoPoint.js";
import { complement, mean, median, percent } from "../domain/scoreUtils.js";

export interface BinAccessMeasure {
  readonly medianDistanceToDisposalM: number | null;
  readonly value: number | null;
}

// scores-v1 bin access: confirmed no-bin reports and distance to the nearest legal disposal point.
export class BinAccessScore {
  measure(sites: AreaSites, disposalPoints: readonly GeoPoint[]): BinAccessMeasure {
    if (disposalPoints.length === 0) {
      return { medianDistanceToDisposalM: null, value: null };
    }
    const distances = sites.verified().map((site) => Math.min(...disposalPoints.map((point) => site.distanceTo(point))));
    const medianDistance = median(distances);
    const noBinShare = percent(sites.noBinReports(), sites.verifiedReports());
    const distancePart = medianDistance === null ? null : Math.max(0, 100 - medianDistance / 10);
    return { medianDistanceToDisposalM: medianDistance, value: mean([complement(noBinShare), distancePart]) };
  }
}
