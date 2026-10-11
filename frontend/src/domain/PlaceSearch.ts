import { NameQuery } from './NameQuery';
import type { LonLat, SiteFeature, SiteProperties } from './Site';

export type PlaceKind = 'ward' | 'assembly' | 'loksabha' | 'local_body' | 'town';

/** A seat from the app's own boundary files (public/boundaries/areas_labels.geojson): its name and middle. */
export interface SeatLabel {
  readonly id: string;
  readonly name: string;
  readonly kind: 'assembly' | 'loksabha';
  readonly point: LonLat;
}

export interface Place {
  readonly name: string;
  readonly kind: PlaceKind;
  /** The loaded sites in this place; empty for a seat with none on the map yet. */
  readonly sites: readonly SiteFeature[];
  /** The seat's middle, when the boundary files know the place. */
  readonly point: LonLat | null;
}

interface Entry {
  readonly name: string;
  readonly kind: PlaceKind;
  readonly sites: SiteFeature[];
  point: LonLat | null;
}

const MAX_RESULTS = 6;
// Smallest first, as the Areas tab lists them.
const KIND_ORDER: readonly PlaceKind[] = ['ward', 'assembly', 'loksabha', 'local_body', 'town'];

const NAMES: Readonly<Record<PlaceKind, (site: SiteProperties) => string | null | undefined>> = {
  ward: (site) => site.location.ward?.name,
  assembly: (site) => site.location.assembly_seat?.name,
  loksabha: (site) => site.location.loksabha_seat.name,
  local_body: (site) => site.location.local_body?.name,
  town: (site) => site.location.town,
};

const keyOf = (kind: PlaceKind, name: string) => `${kind}:${name.toLocaleLowerCase()}`;

/**
 * Wards, seats and localities by name: every assembly and Lok Sabha seat the app ships boundaries for, and
 * every place named in the loaded sites, with those sites. No geocoder: only names already in the app.
 */
export class PlaceSearch {
  readonly #places: readonly Place[];

  constructor(sites: readonly SiteFeature[], seats: readonly SeatLabel[] = []) {
    const byKey = new Map<string, Entry>();
    for (const site of sites) PlaceSearch.#addSite(byKey, site);
    for (const seat of seats) {
      const entry = byKey.get(keyOf(seat.kind, seat.name));
      // Two seats may share a name in different states: the second is its own result, never merged into the first.
      const key = entry?.point ? `${seat.kind}#${seat.id}` : keyOf(seat.kind, seat.name);
      if (entry && !entry.point) entry.point = seat.point;
      else byKey.set(key, { name: seat.name, kind: seat.kind, sites: [], point: seat.point });
    }
    this.#places = [...byKey.values()];
  }

  /**
   * Names that start with the text first, then places with sites on the map, then the smaller kinds. Text in
   * Devanagari matches the Latin names by sound (NameQuery), so जोधपुर finds Jodhpur.
   */
  find(query: string): readonly Place[] {
    const text = NameQuery.of(query);
    if (text.empty) return [];
    const rank = (place: Place) => {
      const start = text.starts(place.name) ? 0 : 1;
      return start * 100 + (place.sites.length > 0 ? 0 : 10) + KIND_ORDER.indexOf(place.kind);
    };
    return this.#places
      .filter((place) => text.matches(place.name))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
      .slice(0, MAX_RESULTS);
  }

  static #addSite(byKey: Map<string, Entry>, site: SiteFeature): void {
    for (const kind of KIND_ORDER) {
      const name = NAMES[kind](site.properties);
      if (!name) continue;
      const entry = byKey.get(keyOf(kind, name)) ?? { name, kind, sites: [], point: null };
      entry.sites.push(site);
      byKey.set(keyOf(kind, name), entry);
    }
  }
}
