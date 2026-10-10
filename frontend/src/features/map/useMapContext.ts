import { useOutletContext } from 'react-router';
import type { LonLat, SiteFeature } from '../../domain/Site';

export interface MapContext {
  readonly userLocation: LonLat | null;
  /** A sheet calls this once its site has loaded, so deep links move the map to it. */
  readonly showSite: (site: SiteFeature) => void;
  /** Sites loaded for the current map view, before filters. */
  readonly sites: readonly SiteFeature[];
  /** Fetches the map's sites again after a change, such as a withdrawn report. */
  readonly refreshSites: () => void;
  /** Shows a short toast over the map; key is an i18n key. */
  readonly announce: (key: string) => void;
}

const DETACHED: MapContext = { userLocation: null, showSite: () => undefined, sites: [], refreshSites: () => undefined, announce: () => undefined };

export function useMapContext(): MapContext {
  return useOutletContext<MapContext | undefined>() ?? DETACHED;
}
