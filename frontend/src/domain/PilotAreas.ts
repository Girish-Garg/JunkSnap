import { AreaKey } from './AreaKey';

/** The pilot city's local body: the head of it is who area letters go To. No scores route covers it. */
export interface LocalBody {
  readonly id: string;
  readonly name: string;
}

/**
 * Every area of the pilot city, listed whether or not anyone has reported there, so the Areas tab never
 * depends on reports to know the city. Counts and scores still come only from the api.
 *
 * - Assembly seats: Jodhpur district's eight seats since the Rajasthan district changes of December 2024
 *   (Jodhpur Rural folded back in; Phalodi and Lohawat stay in Phalodi district). Ids and names are those of
 *   data/boundaries/rajasthan_assembly.geojson, the file the map draws.
 * - Lok Sabha seats: the seats those eight belong to (`pc_id` in the same file), named as in
 *   data/boundaries/india_loksabha.geojson: Jodhpur, and Pali for Osian, Bhopalgarh and Bilara.
 * - District: the id the server's geocoder writes (`<state>-<district>`).
 *
 * Wards are left out until a ward map is reviewed (data/boundaries/SOURCES.md).
 */
export const PILOT_AREAS: readonly AreaKey[] = [
  new AreaKey('assembly', 's20-ac-124', 'Shergarh'),
  new AreaKey('assembly', 's20-ac-125', 'Osian'),
  new AreaKey('assembly', 's20-ac-126', 'Bhopalgarh'),
  new AreaKey('assembly', 's20-ac-127', 'Sardarpura'),
  new AreaKey('assembly', 's20-ac-128', 'Jodhpur'),
  new AreaKey('assembly', 's20-ac-129', 'Soorsagar'),
  new AreaKey('assembly', 's20-ac-130', 'Luni'),
  new AreaKey('assembly', 's20-ac-131', 'Bilara'),
  new AreaKey('loksabha', 's20-pc-16', 'Jodhpur'),
  new AreaKey('loksabha', 's20-pc-15', 'Pali'),
  new AreaKey('district', 'rajasthan-jodhpur', 'Jodhpur'),
];

/** From data/representatives/local_bodies.json. */
export const PILOT_LOCAL_BODY: LocalBody = { id: 'jodhpur-mc', name: 'Jodhpur Municipal Corporation' };

/** A pilot-city area by kind and id, or null. */
export function pilotArea(kind: string, id: string): AreaKey | null {
  return PILOT_AREAS.find((area) => area.kind === kind && area.id === id) ?? null;
}
