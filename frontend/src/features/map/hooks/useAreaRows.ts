import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { CITIES } from '../../../domain/AreaListing';
import type { AreaScores } from '../../../domain/AreaScores';
import type { MapAreaKind } from '../../../services/BoundaryCatalog';

const LIMIT = 200;
const NONE: readonly AreaScores[] = [];
// The map's areas are assembly seats where they exist and Lok Sabha seats elsewhere; ids never clash.
const KINDS: readonly MapAreaKind[] = ['assembly', 'loksabha'];

/** Scores rows of the map's areas in the cities the app covers, for the fill and the markers. */
export function useAreaRows(enabled: boolean): readonly AreaScores[] {
  const { areas } = useServices();
  const [rows, setRows] = useState<readonly AreaScores[]>(NONE);
  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    const requests = KINDS.flatMap((kind) => CITIES.map((city) => areas.list(kind, city.id, LIMIT)));
    // One list failing leaves the others' fill in place.
    void Promise.allSettled(requests).then((results) => {
      const loaded = results.flatMap((result) => {
        if (result.status === 'fulfilled') return result.value.areas;
        console.error('Could not load areas for the map', result.reason);
        return [];
      });
      if (current) setRows(loaded);
    });
    return () => {
      current = false;
    };
  }, [areas, enabled]);
  return enabled ? rows : NONE;
}
