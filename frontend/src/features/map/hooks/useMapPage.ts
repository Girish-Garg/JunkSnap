import { useState } from 'react';
import { useLocation } from 'react-router';
import type { MapMode } from '../../../domain/MapMode';
import { SiteFilter } from '../../../domain/SiteFilter';
import { useOnline } from '../../../ui/useOnline';
import { MapNotice } from '../MapNotice';
import type { MapView } from '../SiteMap';
import { useLocate } from './useLocate';
import { useMapFlash } from './useMapFlash';
import { useMapLayers } from './useMapLayers';
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
  const { boundary, layerBindings } = useMapLayers(mode, selection);
  const notice = MapNotice.pick({
    online: useOnline(),
    failed: loaded.failed,
    locationProblem: location.problem,
    loaded: loaded.loaded,
    loadedCount: loaded.sites.length,
    shownCount: sites.length,
    clamped: partial,
    truncated: loaded.truncated,
    flash: flash.key,
  });
  const filters = { filter, setFilter, mode, setMode, open: filtersOpen, setOpen: setFiltersOpen, counts };
  // Every route but the bare map opens a sheet, and so do Filters and the stack list.
  const sheetOpen = pathname !== '/' || filtersOpen || selection.stack !== null;
  const refresh = { refreshSites: loaded.refresh, announce: flash.announce };
  return { loaded: loaded.sites, sites, setView, selection, location, notice, sheetOpen, filters, boundary, layerBindings, ...refresh };
}
