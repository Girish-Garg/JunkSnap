import type { ReportType } from './ReportType';
import type { SiteFeature } from './Site';

/** The listed verification states; rejected sites never reach the map. */
export const SITE_STATES = ['verified', 'unverified'] as const;
export type SiteState = (typeof SITE_STATES)[number];

/** Every type and state is shown until switched off. */
export class SiteFilter {
  readonly #hidden: ReadonlySet<ReportType>;
  readonly #hiddenStates: ReadonlySet<SiteState>;

  constructor(hidden: Iterable<ReportType> = [], hiddenStates: Iterable<SiteState> = []) {
    this.#hidden = new Set(hidden);
    this.#hiddenStates = new Set(hiddenStates);
  }

  shows(type: ReportType): boolean {
    return !this.#hidden.has(type);
  }

  showsState(state: SiteState): boolean {
    return !this.#hiddenStates.has(state);
  }

  /** How many switches differ from the default, for the Filters pill. */
  activeCount(): number {
    return this.#hidden.size + this.#hiddenStates.size;
  }

  toggleType(type: ReportType): SiteFilter {
    const hidden = new Set(this.#hidden);
    if (!hidden.delete(type)) hidden.add(type);
    return new SiteFilter(hidden, this.#hiddenStates);
  }

  toggleState(state: SiteState): SiteFilter {
    const hidden = new Set(this.#hiddenStates);
    if (!hidden.delete(state)) hidden.add(state);
    return new SiteFilter(this.#hidden, hidden);
  }

  matches({ properties }: SiteFeature): boolean {
    const state = properties.verification;
    return this.shows(properties.report_type) && (state === 'rejected' || this.showsState(state));
  }

  apply(sites: readonly SiteFeature[]): readonly SiteFeature[] {
    return this.activeCount() > 0 ? sites.filter((site) => this.matches(site)) : sites;
  }
}
