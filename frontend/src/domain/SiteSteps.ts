import type { SiteFeature } from './Site';

/** Where one site sits in the list's order, for the preview card's next and previous. */
export class SiteSteps {
  readonly #sites: readonly SiteFeature[];
  readonly #index: number;

  private constructor(sites: readonly SiteFeature[], index: number) {
    this.#sites = sites;
    this.#index = index;
  }

  /** null when the site is not in the list (a pin tapped on the map that the list does not hold). */
  static at(sites: readonly SiteFeature[], siteId: string): SiteSteps | null {
    const index = sites.findIndex((site) => site.properties.site_id === siteId);
    return index < 0 ? null : new SiteSteps(sites, index);
  }

  /** 1-based, for "3 of 12". */
  get position(): number {
    return this.#index + 1;
  }

  get total(): number {
    return this.#sites.length;
  }

  /** The list does not wrap round: the first site has no previous, the last no next. */
  previous(): SiteFeature | null {
    return this.#sites[this.#index - 1] ?? null;
  }

  next(): SiteFeature | null {
    return this.#sites[this.#index + 1] ?? null;
  }
}
