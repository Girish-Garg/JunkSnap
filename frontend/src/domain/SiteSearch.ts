import type { ReportType } from './ReportType';
import type { SiteFeature } from './Site';

const MAX_RESULTS = 6;

export class SiteSearch {
  readonly #sites: readonly SiteFeature[];
  readonly #typeLabel: (type: ReportType) => string;

  constructor(sites: readonly SiteFeature[], typeLabel: (type: ReportType) => string) {
    this.#sites = sites;
    this.#typeLabel = typeLabel;
  }

  find(query: string): readonly SiteFeature[] {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length === 0) return [];
    return this.#sites.filter((site) => this.#text(site).includes(needle)).slice(0, MAX_RESULTS);
  }

  #text({ properties }: SiteFeature): string {
    const { location } = properties;
    const names = [
      this.#typeLabel(properties.report_type),
      location.town,
      location.local_body?.name,
      location.ward?.name,
      location.assembly_seat.name,
      location.loksabha_seat.name,
      location.district.name,
    ];
    return names.filter(Boolean).join(' ').toLocaleLowerCase();
  }
}
