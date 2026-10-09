import type { SiteProperties } from './Site';
import type { SizeClass } from './SiteInsights';

const SIZE_BONUS: Readonly<Record<SizeClass, number>> = { small: 0, medium: 0.1, large: 0.2 };
const HAZARD_BONUS = 0.1;

/** A site's heatmap weight, 0 to 1: verified and total reports, plus size and hazards when insights exist. */
export class HeatWeight {
  static of(site: SiteProperties): number {
    const verified = Math.min(site.verified_count / 5, 1);
    const reports = Math.min(site.report_count / 10, 1);
    const size = site.insights?.size_class ? SIZE_BONUS[site.insights.size_class.value] : 0;
    const hazard = site.insights?.hazards.length ? HAZARD_BONUS : 0;
    return Math.min(0.4 * verified + 0.3 * reports + size + hazard, 1);
  }
}
