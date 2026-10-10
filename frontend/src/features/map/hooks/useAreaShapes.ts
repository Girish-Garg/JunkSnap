import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { AreaShapes } from '../../../domain/AreaShapes';
import { TINT_COUNT } from '../../../layers/boundaries/AreaTints';

export interface AreaShapesState {
  /** The polygons, to find the area someone stands in; null until read. */
  readonly shapes: AreaShapes | null;
  /** Area id to neighbour tint slot; empty until read. */
  readonly tints: ReadonlyMap<string, number>;
}

const NONE: AreaShapesState = { shapes: null, tints: new Map() };

/**
 * The map's area polygons and their neighbour tints, for one index version; null skips the read (no areas
 * layer). BoundaryCatalog reads and colours them once per version, so the map page is the only caller and
 * hands the tints on to its sheets (MapContext).
 */
export function useAreaShapes(version: string | null): AreaShapesState {
  const { boundaries } = useServices();
  const [state, setState] = useState<AreaShapesState>(NONE);
  useEffect(() => {
    if (version === null) return undefined;
    let current = true;
    boundaries.areaShapes(version, TINT_COUNT).then(
      (shapes) => current && setState({ shapes, tints: shapes.tints }),
      (error: unknown) => console.error('Could not read the area polygons', error),
    );
    return () => {
      current = false;
    };
  }, [boundaries, version]);
  return version === null ? NONE : state;
}
