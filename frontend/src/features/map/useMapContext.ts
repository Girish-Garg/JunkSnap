import { useOutletContext } from 'react-router';
import type { LonLat, SiteFeature } from '../../domain/Site';

export interface MapContext {
  readonly userLocation: LonLat | null;
  /** A sheet calls this once its site has loaded, so deep links move the map to it. */
  readonly showSite: (site: SiteFeature) => void;
}

const DETACHED: MapContext = { userLocation: null, showSite: () => undefined };

export function useMapContext(): MapContext {
  return useOutletContext<MapContext | undefined>() ?? DETACHED;
}
