import { useCallback } from 'react';
import { useConfig } from '../../../app/useConfig';
import type { MapView } from '../SiteMap';
import type { LocateState } from './useLocate';
import type { useMapSelection } from './useMapSelection';
import type { SiteBrowser } from './useSiteBrowser';
import type { SitesLoad } from './useSites';

interface MoveSources {
  readonly view: MapView | null;
  readonly setView: (view: MapView) => void;
  readonly selection: Pick<ReturnType<typeof useMapSelection>, 'frame'>;
  readonly location: LocateState;
  readonly browser: Pick<SiteBrowser, 'visible' | 'follow' | 'showCity'>;
  /** The map's own sites: `loaded` once any view has loaded, then always the last list that arrived. */
  readonly loaded: Pick<SitesLoad, 'loaded' | 'sites'>;
}

/**
 * The person's own moves: the map's view as it changes, "Show my location" (asks, then flies there),
 * "Go to my location" for a fix read quietly on open or taken at start, which never moves the map by itself, and
 * the way back to the pilot city's reports, which is only ever offered, never taken for the person.
 */
export function useMapMoves({ view, setView, selection, location, browser, loaded }: MoveSources) {
  const { frame } = selection;
  const { position, locate } = location;
  const { visible, follow, showCity } = browser;
  const { pilot: city } = useConfig();
  const onViewChange = useCallback(
    (next: MapView) => {
      setView(next);
      // The list follows the map the person moves under it; flying in to a picked site keeps the list.
      if (next.byUser && visible) follow();
    },
    [setView, visible, follow],
  );
  const locateMe = useCallback(() => void locate().then((found) => found && frame([found])), [locate, frame]);
  const goToMe = useCallback(() => position && frame([position]), [position, frame]);
  // The fix lies outside the map's view: offer to go there.
  const away = position !== null && view !== null && !view.bbox.contains(position);
  // The map's middle has left the pilot city, where the real reports are; it opens there, so no view yet is on it.
  const offPilot = view !== null && !city.shows(view.bbox);
  // Off the city with no site on the map: nothing on screen says where the reports are. The last list stays up
  // while the next one loads, so a pan across an empty stretch never blinks.
  const stranded = offPilot && loaded.loaded && loaded.sites.length === 0;
  return { onViewChange, locateMe, goToMe, away, offPilot, stranded, showPilot: showCity };
}
