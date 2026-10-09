import type { SiteFeature, SiteProperties } from './Site';

export type PlaceKind = 'ward' | 'assembly' | 'loksabha' | 'local_body' | 'town';

export interface Place {
  readonly name: string;
  readonly kind: PlaceKind;
  readonly sites: readonly SiteFeature[];
}

const MAX_RESULTS = 6;

const NAMES: Readonly<Record<PlaceKind, (site: SiteProperties) => string | null | undefined>> = {
  ward: (site) => site.location.ward?.name,
  assembly: (site) => site.location.assembly_seat.name,
  loksabha: (site) => site.location.loksabha_seat.name,
  local_body: (site) => site.location.local_body?.name,
  town: (site) => site.location.town,
};

/** Wards, seats and localities named in the loaded sites, with the sites in each. */
export class PlaceSearch {
  readonly #places: readonly Place[];

  constructor(sites: readonly SiteFeature[]) {
    const byKey = new Map<string, { name: string; kind: PlaceKind; sites: SiteFeature[] }>();
    for (const site of sites) {
      for (const [kind, nameOf] of Object.entries(NAMES) as [PlaceKind, (s: SiteProperties) => string | null | undefined][]) {
        const name = nameOf(site.properties);
        if (!name) continue;
        const entry = byKey.get(`${kind}:${name}`) ?? { name, kind, sites: [] };
        entry.sites.push(site);
        byKey.set(`${kind}:${name}`, entry);
      }
    }
    this.#places = [...byKey.values()];
  }

  find(query: string): readonly Place[] {
    const needle = query.trim().toLocaleLowerCase();
    if (needle.length === 0) return [];
    return this.#places.filter((place) => place.name.toLocaleLowerCase().includes(needle)).slice(0, MAX_RESULTS);
  }
}
