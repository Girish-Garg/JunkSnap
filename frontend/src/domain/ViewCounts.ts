import type { BBox } from './BBox';
import { REPORT_TYPES, type ReportType } from './ReportType';
import type { SiteFeature } from './Site';
import { SITE_STATES, type SiteFilter, type SiteState } from './SiteFilter';

const zeros = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

/**
 * The Filters sheet's counts: loaded sites inside the visible view, never totals. Each switch counts the
 * sites it would show with the other switches as they are, so a type's count drops when Unverified is off.
 */
export class ViewCounts {
  readonly types: Readonly<Record<ReportType, number>>;
  readonly states: Readonly<Record<SiteState, number>>;

  private constructor(types: Readonly<Record<ReportType, number>>, states: Readonly<Record<SiteState, number>>) {
    this.types = types;
    this.states = states;
  }

  static of(sites: readonly SiteFeature[], view: BBox, filter: SiteFilter): ViewCounts {
    const types = zeros(REPORT_TYPES);
    const states = zeros(SITE_STATES);
    for (const { properties, geometry } of sites) {
      const state = properties.verification;
      if (state === 'rejected' || !view.contains(geometry.coordinates)) continue;
      if (filter.showsState(state)) types[properties.report_type] += 1;
      if (filter.shows(properties.report_type)) states[state] += 1;
    }
    return new ViewCounts(types, states);
  }
}
