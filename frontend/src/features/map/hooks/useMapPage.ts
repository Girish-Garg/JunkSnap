import { useCallback, useState } from 'react';
import { useLocation } from 'react-router';
import type { MapMode } from '../../../domain/MapMode';
import { SiteFilter } from '../../../domain/SiteFilter';
import type { MapView } from '../SiteMap';
import { useLocate } from './useLocate';
import { useMapDiscovery } from './useMapDiscovery';
import { useMapFlash } from './useMapFlash';
import { useMapLayers } from './useMapLayers';
import { useMapMoves } from './useMapMoves';
import { useMapNotice } from './useMapNotice';
import { useMapSelection } from './useMapSelection';
import { useSiteBrowser } from './useSiteBrowser';
import { useSiteData } from './useSiteData';
import type { SitesLoad } from './useSites';

export type MapPageState = ReturnType<typeof useMapPage>;

/** Whether this view has finished loading empty, or with sites in it; neither while loading or failed. */
function settledState(loaded: SitesLoad, partial: boolean) {
  const settled = loaded.loaded && !loaded.pending && !loaded.failed && !partial;
  return { empty: settled && loaded.sites.length === 0, found: settled && loaded.sites.length > 0 };
}

/** Everything the map screen shows, gathered from the smaller hooks. */
export function useMapPage() {
  const { pathname } = useLocation();
  const [view, setView] = useState<MapView | null>(null);
  const [filter, setFilter] = useState(() => new SiteFilter());
  const [mode, setMode] = useState<MapMode>('auto');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { loaded, sites, counts, partial } = useSiteData(view, filter);
  const selection = useMapSelection(loaded.sites);
  const location = useLocate();
  const flash = useMapFlash();
  const { boundary, layerBindings } = useMapLayers(mode, selection);
  const { empty, found } = settledState(loaded, partial);
  const browser = useSiteBrowser({ loaded: loaded.sites, view, filter, position: location.position, empty, selection });
  const discovery = { view, empty, found, deepLinked: selection.openId !== null, camera: selection.camera, pilot: browser.pilot };
  const nearby = useMapDiscovery({ ...discovery, frame: selection.frame });
  const notice = useMapNotice({ loaded, shown: sites.length, partial, locationProblem: location.problem, nearby, flash: flash.key });
  const moves = useMapMoves({ view, setView, selection, location, browser });
  const { showPlace } = selection;
  const showNearest = useCallback(() => showPlace({ sites: nearby?.slice(0, 1) ?? [], point: null }), [showPlace, nearby]);
  const filters = { filter, setFilter, mode, setMode, open: filtersOpen, setOpen: setFiltersOpen, counts };
  // Every route but the bare map opens a sheet, and so do Filters, the stack list and the site list.
  const sheetOpen = pathname !== '/' || filtersOpen || selection.stack !== null || browser.visible;
  const refresh = { refreshSites: loaded.refresh, announce: flash.announce };
  return { loaded: loaded.sites, sites, selection, location, notice, showNearest, sheetOpen, filters, boundary, layerBindings, browser, ...moves, ...refresh };
}
