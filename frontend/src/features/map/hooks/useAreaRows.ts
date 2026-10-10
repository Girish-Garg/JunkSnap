import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { CITIES, type BoundaryKind } from '../../../domain/AreaListing';
import type { AreaScores } from '../../../domain/AreaScores';

const LIMIT = 200;
const NONE: readonly AreaScores[] = [];

interface RowsResult {
  readonly kind: BoundaryKind;
  readonly rows: readonly AreaScores[];
}

/** Scores rows of every area of this kind in the cities the app covers, for the map fill. */
export function useAreaRows(kind: BoundaryKind | null): readonly AreaScores[] {
  const { areas } = useServices();
  const [result, setResult] = useState<RowsResult | null>(null);
  useEffect(() => {
    if (!kind) return undefined;
    let current = true;
    // One city failing leaves the other city's fill in place.
    void Promise.allSettled(CITIES.map((city) => areas.list(kind, city.id, LIMIT))).then((results) => {
      const rows = results.flatMap((result) => {
        if (result.status === 'fulfilled') return result.value.areas;
        console.error(`Could not load ${kind} areas for the map`, result.reason);
        return [];
      });
      if (current) setResult({ kind, rows });
    });
    return () => {
      current = false;
    };
  }, [areas, kind]);
  return result && result.kind === kind ? result.rows : NONE;
}
