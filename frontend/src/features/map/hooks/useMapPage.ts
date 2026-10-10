import { useCallback, useState } from 'react';
import { useLocation } from 'react-router';
import type { MapMode } from '../../../domain/MapMode';
import { SiteFilter } from '../../../domain/SiteFilter';
import type { MapView } from '../SiteMap';
import { useLocate } from './useLocate';
import { useMapDiscovery } from './useMapDiscovery';
import { useMapFlash } from './useMapFlash';
import { useMapLayers } from './useMapLayers';
import { useMapNotice } from './useMapNotice';
import { useMapSelection } from './useMapSelection';
import { useSiteData } from './useSiteData';

export type MapPageState = ReturnType<typeof useMapPage>;

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
  const { boundary, areaCard, layerBindings } = useMapLayers(mode, selection, location.position);
  const settled = loaded.loaded && !loaded.pending && !loaded.failed && !partial;
  const discovery = { view, located: location.position !== null, camera: selection.camera, frame: selection.frame };
  const nearby = useMapDiscovery({ ...discovery, empty: settled && loaded.sites.length === 0, found: settled && loaded.sites.length > 0 });
  const notice = useMapNotice({ loaded, shown: sites.length, partial, locationProblem: location.problem, nearby, flash: flash.key });
  const { showPlace } = selection;
  const showNearest = useCallback(() => showPlace({ sites: nearby?.slice(0, 1) ?? [], point: null }), [showPlace, nearby]);
  const filters = { filter, setFilter, mode, setMode, open: filtersOpen, setOpen: setFiltersOpen, counts };
  // Every route but the bare map opens a sheet, and so do Filters and the stack list.
  const sheetOpen = pathname !== '/' || filtersOpen || selection.stack !== null;
  const refresh = { refreshSites: loaded.refresh, announce: flash.announce };
  return { loaded: loaded.sites, sites, setView, selection, location, notice, showNearest, sheetOpen, filters, boundary, areaCard, layerBindings, ...refresh };
}
