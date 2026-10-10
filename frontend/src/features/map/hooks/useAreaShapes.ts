import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { AreaAdjacency } from '../../../domain/AreaAdjacency';
import { AreaColouring } from '../../../domain/AreaColouring';
import { AreaShapes } from '../../../domain/AreaShapes';
import { TINT_COUNT } from '../../../layers/boundaries/AreaTints';

export interface AreaShapesState {
  /** The polygons, to find the area someone stands in; null until read. */
  readonly shapes: AreaShapes | null;
  /** Area id to neighbour tint slot; empty until read. */
  readonly tints: ReadonlyMap<string, number>;
}

const NONE: AreaShapesState = { shapes: null, tints: new Map() };

/** Reads the map's area polygons once the layer is drawn and colours them so no two neighbours match. */
export function useAreaShapes(enabled: boolean): AreaShapesState {
  const { boundaries } = useServices();
  const [state, setState] = useState<AreaShapesState>(NONE);
  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    boundaries.polygons().then(
      (polygons) => {
        // A missing or odd file leaves the areas untinted, as before.
        if (!current || !Array.isArray(polygons.features)) return;
        setState({ shapes: new AreaShapes(polygons), tints: AreaColouring.of(AreaAdjacency.of(polygons), TINT_COUNT) });
      },
      (error: unknown) => console.error('Could not read the area polygons', error),
    );
    return () => {
      current = false;
    };
  }, [boundaries, enabled]);
  return enabled ? state : NONE;
}
