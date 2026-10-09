import type { ReportType } from './ReportType';
import type { SiteFeature } from './Site';

export class SiteFilter {
  readonly #types: ReadonlySet<ReportType>;
  readonly verifiedOnly: boolean;

  constructor(types: Iterable<ReportType> = [], verifiedOnly = false) {
    this.#types = new Set(types);
    this.verifiedOnly = verifiedOnly;
  }

  hasType(type: ReportType): boolean {
    return this.#types.has(type);
  }

  isActive(): boolean {
    return this.#types.size > 0 || this.verifiedOnly;
  }

  toggleType(type: ReportType): SiteFilter {
    const types = new Set(this.#types);
    if (!types.delete(type)) types.add(type);
    return new SiteFilter(types, this.verifiedOnly);
  }

  toggleVerifiedOnly(): SiteFilter {
    return new SiteFilter(this.#types, !this.verifiedOnly);
  }

  /** No type chip on means every type. */
  matches({ properties }: SiteFeature): boolean {
    const typeOk = this.#types.size === 0 || this.#types.has(properties.report_type);
    return typeOk && (!this.verifiedOnly || properties.verification === 'verified');
  }

  apply(sites: readonly SiteFeature[]): readonly SiteFeature[] {
    return this.isActive() ? sites.filter((site) => this.matches(site)) : sites;
  }
}
