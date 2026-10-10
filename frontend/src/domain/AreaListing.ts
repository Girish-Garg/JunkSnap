import type { AreaKind, AreaScores } from './AreaScores';

/** Area kinds the map draws as boundaries; districts are what a ranking is within. */
export const BOUNDARY_KINDS = ['ward', 'assembly', 'loksabha'] as const;

export type BoundaryKind = (typeof BOUNDARY_KINDS)[number];

/**
 * Mirrors area_list.schema.json (GET /areas/{kind}?within=<district-or-local-body-id>&limit=<n>):
 * the scores rows of the areas of that kind with sites there, worst first.
 */
export interface AreaListing {
  readonly kind: AreaKind;
  readonly within: string;
  /** Matching areas before the limit. */
  readonly total: number;
  readonly limit: number;
  readonly areas: readonly AreaScores[];
}

export interface City {
  /** The district id the area list route filters by. */
  readonly id: string;
  /** i18n key suffix under ranking.city. */
  readonly key: string;
}

/** Jodhpur is the pilot city and the default everywhere. */
export const CITIES: readonly City[] = [
  { id: 'rajasthan-jodhpur', key: 'jodhpur' },
  { id: 'rajasthan-jaipur', key: 'jaipur' },
];

export const DEFAULT_CITY: City = CITIES[0] as City;

export function isBoundaryKind(value: string): value is BoundaryKind {
  return (BOUNDARY_KINDS as readonly string[]).includes(value);
}

export function cityById(id: string | null): City {
  return CITIES.find((city) => city.id === id) ?? DEFAULT_CITY;
}
