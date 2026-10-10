import { AREA_KINDS, AreaKey } from './AreaKey';
import type { AreaListing } from './AreaListing';
import type { AreaScores } from './AreaScores';
import type { SiteFeature } from './Site';

/** One area in the Areas tab, with its scores row when the area list route has one; null means no reports yet. */
export interface AreaEntry {
  readonly area: AreaKey;
  readonly row: AreaScores | null;
}

// The pilot city plus the districts around the map; more would mean a dozen more requests per open.
const MAX_DISTRICTS = 3;

/**
 * The Areas tab's list: every area of the pilot city from the shipped boundary data (PILOT_AREAS), reported or
 * not, merged with every row GET /areas/{kind} returns for the pilot city and the map's own districts.
 */
export class AreaDirectory {
  /**
   * The district ids to list: the pilot city first, then the districts of the sites around the map in id order,
   * so the same districts always make the same requests, whatever order the sites arrived in.
   */
  static districts(pilotId: string, sites: readonly SiteFeature[]): readonly string[] {
    const others = new Set(sites.map((site) => site.properties.location.district.id));
    others.delete(pilotId);
    return [pilotId, ...[...others].sort()].slice(0, MAX_DISTRICTS);
  }

  /**
   * Each area once, smallest kind first, then by name. A listed row fills in its area's counts and scores;
   * an area no row names keeps row null (the worker writes a row only once a site lands there).
   */
  static of(listings: readonly AreaListing[], known: readonly AreaKey[] = []): readonly AreaEntry[] {
    const byKey = new Map<string, AreaEntry>(known.map((area) => [area.key, { area, row: null }]));
    for (const row of listings.flatMap((listing) => listing.areas)) {
      const area = new AreaKey(row.area.kind, row.area.id, row.area.name);
      byKey.set(area.key, { area, row });
    }
    const rank = (entry: AreaEntry) => AREA_KINDS.indexOf(entry.area.kind);
    return [...byKey.values()].sort((a, b) => rank(a) - rank(b) || a.area.name.localeCompare(b.area.name));
  }

  /** The entries whose name holds the text; all of them for empty text. */
  static match(entries: readonly AreaEntry[], query: string): readonly AreaEntry[] {
    const needle = AreaDirectory.needle(query);
    return needle ? entries.filter((entry) => AreaDirectory.holds(entry.area.name, needle)) : entries;
  }

  /** Whether a name matches the search text (case and surrounding spaces ignored). */
  static matches(name: string, query: string): boolean {
    const needle = AreaDirectory.needle(query);
    return !needle || AreaDirectory.holds(name, needle);
  }

  static needle(query: string): string {
    return query.trim().toLocaleLowerCase();
  }

  static holds(name: string, needle: string): boolean {
    return name.toLocaleLowerCase().includes(needle);
  }
}
