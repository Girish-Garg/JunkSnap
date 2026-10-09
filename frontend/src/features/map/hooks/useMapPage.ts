import { useCallback, useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';
import { SITE_PATH, SNAP_PATH, sitePath } from '../../../app/paths';
import { SiteFilter } from '../../../domain/SiteFilter';
import { useOnline } from '../../../ui/useOnline';
import { MapNotice } from '../MapNotice';
import type { MapView } from '../SiteMap';
import { useLocate } from './useLocate';
import { useSites } from './useSites';

export function useMapPage() {
  const navigate = useNavigate();
  const selectedId = useMatch(SITE_PATH)?.params.siteId ?? null;
  const snapOpen = useMatch(SNAP_PATH) !== null;
  const sheetOpen = selectedId !== null || snapOpen;
  const [view, setView] = useState<MapView | null>(null);
  const [filter, setFilter] = useState(() => new SiteFilter());
  const loaded = useSites(view?.bbox ?? null);
  const sites = useMemo(() => filter.apply(loaded.sites), [filter, loaded.sites]);
  const location = useLocate();
  const notice = MapNotice.pick({
    online: useOnline(),
    failed: loaded.failed,
    locationProblem: location.problem,
    loaded: loaded.loaded,
    loadedCount: loaded.sites.length,
    shownCount: sites.length,
    clamped: view?.clamped ?? false,
  });
  const select = useCallback((siteId: string) => navigate(sitePath(siteId)), [navigate]);
  const openSnap = useCallback(() => navigate(SNAP_PATH), [navigate]);
  return { selectedId, sheetOpen, setView, filter, setFilter, sites, location, notice, select, openSnap };
}
