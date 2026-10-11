import type { BBox } from './BBox';
import type { PilotCity } from './PilotCity';
import type { LonLat, SiteFeature } from './Site';
import type { SiteFilter } from './SiteFilter';
import { SiteListing } from './SiteListing';
import { SiteOrder, type SiteSort } from './SiteOrder';

/** The sites the list was opened on; frozen once a row is picked, so flying the map in does not empty it. */
export interface BrowseSource {
  readonly sites: readonly SiteFeature[];
  /** Where "nearest" measures from when the person's location is unknown: the view's middle. */
  readonly middle: LonLat;
}

export interface BrowseInput {
  readonly source: BrowseSource;
  /** The sites loaded for the map now: a frozen row takes the newest copy of its site from here. */
  readonly loaded: readonly SiteFeature[];
  /** The pilot city's sites, or null while they load; listed when the view has none. */
  readonly pilot: readonly SiteFeature[] | null;
  /** The pilot city itself (the config's VITE_PILOT_*). */
  readonly city: PilotCity;
  readonly filter: SiteFilter;
}

export interface BrowseRows {
  readonly sites: readonly SiteFeature[];
  /** The view held no site after the filters, so these are the pilot city's sites. */
  readonly fallback: boolean;
}

/** The list sheet's rows: the sites of the view (or of Jodhpur when the view has none), filtered and sorted. */
export class SiteBrowse {
  static rows(input: BrowseInput, sort: SiteSort, from: LonLat | null): BrowseRows {
    const own = SiteBrowse.own(input, sort, from);
    return own.length > 0 ? { sites: own, fallback: false } : { sites: SiteBrowse.city(input, sort, from), fallback: true };
  }

  /** The view's own rows; when there are none, the list falls back to the pilot city (and only then loads it). */
  static own(input: Omit<BrowseInput, 'pilot' | 'city'>, sort: SiteSort, from: LonLat | null): readonly SiteFeature[] {
    const own = input.filter.apply(SiteBrowse.#fresh(input.source.sites, input.loaded));
    return SiteOrder.sort(own, sort, from ?? input.source.middle);
  }

  /** The pilot city's rows, through the same filters and order. */
  static city(input: Pick<BrowseInput, 'pilot' | 'city' | 'loaded' | 'filter'>, sort: SiteSort, from: LonLat | null): readonly SiteFeature[] {
    const city = input.filter.apply(input.city.sitesOf(SiteBrowse.#fresh(input.pilot ?? [], input.loaded)));
    return SiteOrder.sort(city, sort, from ?? input.city.centre);
  }

  /** The source for a view: its loaded sites and its middle (the pilot city's while there is no view). */
  static source(sites: readonly SiteFeature[], view: BBox | null, city: PilotCity): BrowseSource {
    return { sites, middle: view?.center() ?? city.centre };
  }

  // Removed, cleaned and expired sites never show, even from a list frozen before they left the map.
  static #fresh(sites: readonly SiteFeature[], loaded: readonly SiteFeature[]): readonly SiteFeature[] {
    const latest = new Map(loaded.map((site) => [site.properties.site_id, site]));
    return sites
      .map((site) => latest.get(site.properties.site_id) ?? site)
      .filter((site) => SiteListing.onMap(site.properties));
  }
}
