import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import type { MapMode } from '../../../domain/MapMode';
import { SiteFilter } from '../../../domain/SiteFilter';
import { useOnline } from '../../../ui/useOnline';
import { MapNotice } from '../MapNotice';
import type { MapView } from '../SiteMap';
import { useLocate } from './useLocate';
import { useMapLayers } from './useMapLayers';
import { useMapSelection } from './useMapSelection';
import { useSites } from './useSites';

export type MapPageState = ReturnType<typeof useMapPage>;

/** Everything the map screen shows, gathered from the smaller hooks. */
export function useMapPage() {
  const { pathname } = useLocation();
  const [view, setView] = useState<MapView | null>(null);
  const [filter, setFilter] = useState(() => new SiteFilter());
  const [mode, setMode] = useState<MapMode>('auto');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const loaded = useSites(view?.bbox ?? null);
  const sites = useMemo(() => filter.apply(loaded.sites), [filter, loaded.sites]);
  const selection = useMapSelection(loaded.sites);
  const location = useLocate();
  const { boundary, layerBindings } = useMapLayers(mode, selection);
  const notice = MapNotice.pick({
    online: useOnline(),
    failed: loaded.failed,
    locationProblem: location.problem,
    loaded: loaded.loaded,
    loadedCount: loaded.sites.length,
    shownCount: sites.length,
    clamped: view?.clamped ?? false,
  });
  const filters = { filter, setFilter, mode, setMode, open: filtersOpen, setOpen: setFiltersOpen };
  // Every route but the bare map opens a sheet.
  const sheetOpen = pathname !== '/' || filtersOpen;
  return { loaded: loaded.sites, sites, setView, selection, location, notice, sheetOpen, filters, boundary, layerBindings };
}
