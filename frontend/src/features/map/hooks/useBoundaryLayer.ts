import { useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { BoundaryKind } from '../../../domain/AreaListing';
import { ChoroplethScale } from '../ChoroplethScale';
import { useAreaRows } from './useAreaRows';

export type BoundaryLayerState = ReturnType<typeof useBoundaryLayer>;

// Assembly seats open by default: every Rajasthan site has one, and wards may not be mapped yet.
const DEFAULT_KIND: BoundaryKind = 'assembly';

/** Which boundaries the map shows (null for none), which kinds have files, and each area's fill colour. */
export function useBoundaryLayer() {
  const { boundaries } = useServices();
  const [available, setAvailable] = useState<readonly BoundaryKind[]>([]);
  const [chosen, choose] = useState<BoundaryKind | null>(DEFAULT_KIND);
  useEffect(() => {
    let current = true;
    void boundaries.available().then((kinds) => {
      if (current) setAvailable(kinds);
    });
    return () => {
      current = false;
    };
  }, [boundaries]);
  const kind = chosen !== null && available.includes(chosen) ? chosen : null;
  const rows = useAreaRows(kind);
  const colors = useMemo(() => ChoroplethScale.colors(rows), [rows]);
  return { kind, chosen, choose, available, colors };
}
