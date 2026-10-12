import { useOutletContext } from 'react-router';
import type { LonLat, SiteFeature } from '../../domain/Site';

export interface MapContext {
  readonly userLocation: LonLat | null;
  /** A sheet calls this once its site has loaded, so deep links move the map to it. */
  readonly showSite: (site: SiteFeature) => void;
  /** Fits the map to these points: the sites of a place picked in "Places with reports". */
  readonly frame: (points: readonly LonLat[]) => void;
  /** Fits the pilot city's sites, or the whole city while they are not loaded: the way back to the reports. */
  readonly showPilot: () => void;
  /** Sites loaded for the current map view, before filters. */
  readonly sites: readonly SiteFeature[];
  /** Fetches the map's sites again after a change, such as a withdrawn report. */
  readonly refreshSites: () => void;
  /** Shows a short toast over the map; key is an i18n key. */
  readonly announce: (key: string) => void;
  /** Area id to its neighbour tint slot on the map (AreaColouring), for the Areas tab chips. */
  readonly areaTints: ReadonlyMap<string, number>;
}

const DETACHED: MapContext = {
  userLocation: null,
  showSite: () => undefined,
  frame: () => undefined,
  showPilot: () => undefined,
  sites: [],
  refreshSites: () => undefined,
  announce: () => undefined,
  areaTints: new Map(),
};

export function useMapContext(): MapContext {
  return useOutletContext<MapContext | undefined>() ?? DETACHED;
}
