import { useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { AreaDirectory, type AreaEntry } from '../../../domain/AreaDirectory';
import { AREA_KINDS } from '../../../domain/AreaKey';
import { DEFAULT_CITY } from '../../../domain/AreaListing';
import { useMapContext } from '../../map/useMapContext';

export type { AreaEntry } from '../../../domain/AreaDirectory';

// GET /areas/{kind} caps a page at 200 areas; a district has far fewer wards and seats.
const LIMIT = 200;

export interface AreaDirectoryState {
  /** null while loading. */
  readonly entries: readonly AreaEntry[] | null;
  readonly failed: boolean;
}

interface Loaded {
  readonly entries: readonly AreaEntry[] | null;
}

/**
 * Every reported ward, seat and district of the pilot city and of the districts around the map (where the
 * person is looking, or standing once located), from the area list route; not only the sites on screen.
 */
export function useAreaDirectory(query: string): AreaDirectoryState {
  const { areas } = useServices();
  const { sites } = useMapContext();
  const key = AreaDirectory.districts(DEFAULT_CITY.id, sites).join('|');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let current = true;
    const requests = key.split('|').flatMap((within) => AREA_KINDS.map((kind) => areas.list(kind, within, LIMIT)));
    // One list failing leaves the others in place; only when every one fails does the tab say so.
    void Promise.allSettled(requests).then((results) => {
      const listings = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length > 0) console.error('Could not load some areas', failures[0]?.reason);
      if (current) setLoaded({ entries: listings.length > 0 ? AreaDirectory.of(listings) : null });
    });
    return () => {
      current = false;
    };
  }, [areas, key]);
  // A new district set keeps the last list on screen until its own arrives.
  const entries = useMemo(() => loaded?.entries && AreaDirectory.match(loaded.entries, query), [loaded, query]);
  return { entries: entries ?? null, failed: loaded !== null && loaded.entries === null };
}
