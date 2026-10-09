import { REPORT_TYPES, type ReportType } from './ReportType';
import type { SiteFeature } from './Site';

/** Every type is shown until switched off; "verified only" narrows further. */
export class SiteFilter {
  readonly #hidden: ReadonlySet<ReportType>;
  readonly verifiedOnly: boolean;

  constructor(hidden: Iterable<ReportType> = [], verifiedOnly = false) {
    this.#hidden = new Set(hidden);
    this.verifiedOnly = verifiedOnly;
  }

  static countByType(sites: readonly SiteFeature[]): Readonly<Record<ReportType, number>> {
    const counts = Object.fromEntries(REPORT_TYPES.map((type) => [type, 0])) as Record<ReportType, number>;
    for (const site of sites) counts[site.properties.report_type] += 1;
    return counts;
  }

  shows(type: ReportType): boolean {
    return !this.#hidden.has(type);
  }

  /** How many switches differ from the default, for the Filters pill. */
  activeCount(): number {
    return this.#hidden.size + (this.verifiedOnly ? 1 : 0);
  }

  toggleType(type: ReportType): SiteFilter {
    const hidden = new Set(this.#hidden);
    if (!hidden.delete(type)) hidden.add(type);
    return new SiteFilter(hidden, this.verifiedOnly);
  }

  toggleVerifiedOnly(): SiteFilter {
    return new SiteFilter(this.#hidden, !this.verifiedOnly);
  }

  matches({ properties }: SiteFeature): boolean {
    return this.shows(properties.report_type) && (!this.verifiedOnly || properties.verification === 'verified');
  }

  apply(sites: readonly SiteFeature[]): readonly SiteFeature[] {
    return this.activeCount() > 0 ? sites.filter((site) => this.matches(site)) : sites;
  }
}
