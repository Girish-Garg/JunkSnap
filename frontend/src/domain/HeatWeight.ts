import type { SiteProperties } from './Site';
import type { SizeClass } from './SiteInsights';

// Every site on the map shows in the heat: a fresh one-report site still glows (teal), not 0.03 and invisible.
const FLOOR = 0.4;
// People backing it, 10 needed (decision 20261010-1530): a verified site gets all of it.
const BACKERS = 0.35;
const REPORTS = 0.15;
const SIZE_BONUS: Readonly<Record<SizeClass, number>> = { small: 0, medium: 0.1, large: 0.2 };
const HAZARD_BONUS = 0.1;

type WeightInput = Pick<SiteProperties, 'verification' | 'backers' | 'report_count' | 'insights'>;

/** A site's heatmap weight, 0.4 to 1: a floor for being on the map, then backers, reports, size and hazards. */
export class HeatWeight {
  static of(site: WeightInput): number {
    const size = site.insights?.size_class ? SIZE_BONUS[site.insights.size_class.value] : 0;
    const hazard = site.insights?.hazards.length ? HAZARD_BONUS : 0;
    const reports = Math.min(site.report_count / 10, 1);
    return Math.min(FLOOR + BACKERS * HeatWeight.#backing(site) + REPORTS * reports + size + hazard, 1);
  }

  static #backing({ verification, backers }: WeightInput): number {
    if (verification === 'verified') return 1;
    return backers.needed > 0 ? Math.min(backers.count / backers.needed, 1) : 0;
  }
}
