import { useCallback, useState } from 'react';
import { useLocation, useMatch } from 'react-router';
import { SITE_PATH, sitePath } from '../../../app/paths';
import { useSheetNavigation, type SheetNavigation } from '../../../app/useSheetNavigation';
import type { Place } from '../../../domain/PlaceSearch';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { PlaceCamera, type CameraRequest } from '../CameraRequest';
import { usePinPick } from './usePinPick';

type StackPick = Pick<ReturnType<typeof usePinPick>, 'stack' | 'pickStack'>;

/**
 * A stack pin's list takes the place of whatever sheet is open (a site, a tab): it shows on the bare map only, and
 * a pick made with a sheet open first goes back to the map. So the list is never a level over that sheet, and
 * closing it, or the site picked from it, ends on the map.
 */
function useStackOnMap({ stack, pickStack }: StackPick, sheets: SheetNavigation): StackPick {
  const onMap = useLocation().pathname === '/';
  const listStack = useCallback(
    (siteIds: readonly string[]) => {
      pickStack(siteIds);
      if (!onMap) sheets.up('/');
    },
    [pickStack, onMap, sheets],
  );
  return { stack: onMap ? stack : null, pickStack: listStack };
}

/** Which site is previewed or open, which stack pin is listed, and where the camera should go. */
export function useMapSelection(loaded: readonly SiteFeature[]) {
  const sheets = useSheetNavigation();
  const openId = useMatch(SITE_PATH)?.params.siteId ?? null;
  const { preview, setPreview, pick, ...stacks } = usePinPick(loaded);
  const { stack, pickStack } = useStackOnMap(stacks, sheets);
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
