import { useCallback, useState } from 'react';
import { useLocation, useMatch } from 'react-router';
import { SITE_PATH, sitePath } from '../../../app/paths';
import { useSheetNavigation, type SheetNavigation } from '../../../app/useSheetNavigation';
import { WorkSheets } from '../../../app/WorkSheets';
import type { Place } from '../../../domain/PlaceSearch';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { TopLayer } from '../../../ui/TopLayer';
import { PlaceCamera, type CameraRequest } from '../CameraRequest';
import { usePinPick } from './usePinPick';

type StackPick = Pick<ReturnType<typeof usePinPick>, 'stack' | 'pickStack'>;

/**
 * A stack pin's list takes the place of whatever is open (a site, a tab, Filters): it shows only on the bare map
 * with Filters closed, and a pick made with one of those open first closes it (back to the map, or Filters' own
 * close). The list waits for that, so its history entry is never pushed while a step back is on its way, and it is
 * never a level over or under another sheet: closing it, or the site picked from it, ends on the map. A sheet that
 * holds work in progress (WorkSheets) is left alone: there the pick does nothing.
 */
function useStackOnMap({ stack, pickStack }: StackPick, sheets: SheetNavigation, filtersOpen: boolean): StackPick {
  const { pathname } = useLocation();
  const onMap = pathname === '/';
  const listStack = useCallback(
    (siteIds: readonly string[]) => {
      if (WorkSheets.holds(pathname)) return;
      pickStack(siteIds);
      if (!onMap) sheets.up('/');
      // Filters is the top layer whenever it is open beside the map (desktop); on phones the tap closed it already.
      else if (filtersOpen) TopLayer.dismiss();
    },
    [pickStack, pathname, onMap, sheets, filtersOpen],
  );
  return { stack: onMap && !filtersOpen ? stack : null, pickStack: listStack };
}

/** Which site is previewed or open, which stack pin is listed, and where the camera should go. */
export function useMapSelection(loaded: readonly SiteFeature[], filtersOpen = false) {
  const sheets = useSheetNavigation();
  const openId = useMatch(SITE_PATH)?.params.siteId ?? null;
  const { preview, setPreview, pick, ...stacks } = usePinPick(loaded);
  const { stack, pickStack } = useStackOnMap(stacks, sheets, filtersOpen);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const showSite = useCallback((site: SiteFeature) => setCamera({ points: [site.geometry.coordinates] }), []);
  const openDetails = useCallback(
    (site: SiteFeature) => {
      setPreview(null);
      showSite(site);
      // Another site replaces the open one, so back still returns to the map in one step. The card's or the
      // list's history entry comes off first (useSheetNavigation), so nothing is left under the sheet.
      const path = sitePath(site.properties.site_id);
      if (openId) sheets.swap(path);
      else sheets.open(path);
    },
    [sheets, showSite, openId, setPreview],
  );
  const showPlace = useCallback((place: Pick<Place, 'sites' | 'point'>) => {
    setPreview(place.sites.length === 1 ? (place.sites[0] ?? null) : null);
    setCamera(PlaceCamera.for(place));
  }, [setPreview]);
  const frame = useCallback((points: readonly LonLat[]) => setCamera({ points }), []);
  const selectedId = openId ?? preview?.properties.site_id ?? null;
  // Closes the preview card or the stack list, whichever is up.
  const clearPick = useCallback(() => setPreview(null), [setPreview]);
  return { openId, selectedId, preview, stack, camera, pick, pickStack, clearPick, showSite, openDetails, showPlace, frame };
}
