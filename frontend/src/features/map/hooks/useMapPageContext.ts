import type { MapContext } from '../useMapContext';
import type { MapPageState } from './useMapPage';

/** What the map hands to the sheets it hosts (site, areas, home). */
export function useMapPageContext(page: MapPageState): MapContext {
  return {
    userLocation: page.location.position,
    showSite: page.selection.showSite,
    sites: page.loaded,
    refreshSites: page.refreshSites,
    announce: page.announce,
  };
}
