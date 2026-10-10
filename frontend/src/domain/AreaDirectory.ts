import { AREA_KINDS, AreaKey } from './AreaKey';
import type { AreaListing } from './AreaListing';
import type { SiteFeature } from './Site';

/** One area in the Areas tab, with the counts its scores row holds. */
export interface AreaEntry {
  readonly area: AreaKey;
  readonly sites: number;
  readonly verified: number;
}

// The pilot city plus the districts around the map; more would mean a dozen more requests per open.
const MAX_DISTRICTS = 3;

/** The Areas tab's list: every reported area of the pilot city and of the map's own districts, from GET /areas/{kind}. */
export class AreaDirectory {
  /** The district ids to list: the pilot city first, then the districts of the sites around the map. */
  static districts(pilotId: string, sites: readonly SiteFeature[]): readonly string[] {
    const ids = new Set([pilotId, ...sites.map((site) => site.properties.location.district.id)]);
    return [...ids].slice(0, MAX_DISTRICTS);
  }

  /** Each area once, smallest kind first, then by name. */
  static of(listings: readonly AreaListing[]): readonly AreaEntry[] {
    const byKey = new Map<string, AreaEntry>();
    for (const row of listings.flatMap((listing) => listing.areas)) {
      const area = new AreaKey(row.area.kind, row.area.id, row.area.name);
      byKey.set(area.key, { area, sites: row.counts.sites, verified: row.counts.verified_reports });
    }
    const rank = (entry: AreaEntry) => AREA_KINDS.indexOf(entry.area.kind);
    return [...byKey.values()].sort((a, b) => rank(a) - rank(b) || a.area.name.localeCompare(b.area.name));
  }

  /** The entries whose name holds the text; all of them for empty text. */
  static match(entries: readonly AreaEntry[], query: string): readonly AreaEntry[] {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? entries.filter((entry) => entry.area.name.toLocaleLowerCase().includes(needle)) : entries;
  }
}
