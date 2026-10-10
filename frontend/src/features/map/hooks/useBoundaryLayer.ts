import { useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { BoundaryKind } from '../../../domain/AreaListing';
import type { BoundaryIndex } from '../../../services/BoundaryCatalog';
import { ChoroplethScale } from '../ChoroplethScale';
import { useAreaRows } from './useAreaRows';

export type BoundaryLayerState = ReturnType<typeof useBoundaryLayer>;

// Assembly seats open by default: every Rajasthan site has one, and wards may not be mapped yet.
const DEFAULT_KIND: BoundaryKind = 'assembly';
const NO_INDEX: BoundaryIndex = { kinds: [], wardCoverage: [] };

/** Which boundaries the map shows (null for none), which kinds have files, ward coverage, and area fill colours. */
export function useBoundaryLayer() {
  const { boundaries } = useServices();
  const [index, setIndex] = useState<BoundaryIndex>(NO_INDEX);
  const [chosen, choose] = useState<BoundaryKind | null>(DEFAULT_KIND);
  useEffect(() => {
    let current = true;
    void boundaries.index().then((next) => {
      if (current) setIndex(next);
    });
    return () => {
      current = false;
    };
  }, [boundaries]);
  const available = index.kinds;
  const kind = chosen !== null && available.includes(chosen) ? chosen : null;
  const rows = useAreaRows(kind);
  const colors = useMemo(() => ChoroplethScale.colors(rows), [rows]);
  return { kind, chosen, choose, available, wardCoverage: index.wardCoverage, colors };
}
