import { useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { AreasIndex } from '../../../services/BoundaryCatalog';
import type { BoundaryView } from '../BoundaryOverlay';
import { ChoroplethScale } from '../ChoroplethScale';
import { useAreaMarkers } from './useAreaMarkers';
import { useAreaRows } from './useAreaRows';

export type BoundaryLayerState = ReturnType<typeof useBoundaryLayer>;

const NO_INDEX: AreasIndex = { available: false, fine: false, attribution: null };

/** The map's one areas layer: whether it is drawn, how (fine edges, credit), its fills and markers. */
export function useBoundaryLayer() {
  const { boundaries } = useServices();
  const [index, setIndex] = useState<AreasIndex>(NO_INDEX);
  useEffect(() => {
    let current = true;
    void boundaries.index().then((next) => {
      if (current) setIndex(next);
    });
    return () => {
      current = false;
    };
  }, [boundaries]);
  const rows = useAreaRows(index.available);
  const colors = useMemo(() => ChoroplethScale.colors(rows), [rows]);
  const markers = useAreaMarkers(rows);
  const view = useMemo<BoundaryView | null>(
    () => (index.available ? { fine: index.fine, ...(index.attribution ? { attribution: index.attribution } : {}) } : null),
    [index],
  );
  return { view, colors, markers };
}
