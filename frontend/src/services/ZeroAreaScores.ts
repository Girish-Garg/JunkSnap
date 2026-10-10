import type { AreaKey } from '../domain/AreaKey';
import type { AreaScores } from '../domain/AreaScores';
import type { SiteFeature } from '../domain/Site';

const WITHHELD = { value: null, reason: 'too_few_reports' } as const;

/** The row the worker seeds when a site first lands in an area: zero counts, every score withheld, no insights. */
export class ZeroAreaScores {
  static for(area: AreaKey, site: SiteFeature): AreaScores {
    const { pilot, first_reported_at: from, last_reported_at: to } = site.properties;
    return {
      area: { kind: area.kind, id: area.id, name: area.name },
      counts: { verified_reports: 0, no_bin_reports: 0, sites: 0, open_sites: 0, cleaned_sites: 0, reopened_sites: 0 },
      min_verified_reports: 10,
      scores: { city: WITHHELD, citizen: WITHHELD, bin_access: WITHHELD },
      diagnosis: [],
      formula_version: 'scores-v1',
      pilot,
      data_window: { from, to },
      computed_at: to,
    };
  }
}
