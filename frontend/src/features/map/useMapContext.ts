import { useOutletContext } from 'react-router';
import type { LonLat, SiteFeature } from '../../domain/Site';

export interface MapContext {
  readonly userLocation: LonLat | null;
  /** A sheet calls this once its site has loaded, so deep links move the map to it. */
  readonly showSite: (site: SiteFeature) => void;
  /** Sites loaded for the current map view, before filters. */
  readonly sites: readonly SiteFeature[];
}

const DETACHED: MapContext = { userLocation: null, showSite: () => undefined, sites: [] };

export function useMapContext(): MapContext {
  return useOutletContext<MapContext | undefined>() ?? DETACHED;
}
