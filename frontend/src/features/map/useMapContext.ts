import { useOutletContext } from 'react-router';
import type { LonLat } from '../../domain/Site';

export interface MapContext {
  readonly userLocation: LonLat | null;
}

export function useMapContext(): MapContext {
  return useOutletContext<MapContext | undefined>() ?? { userLocation: null };
}
