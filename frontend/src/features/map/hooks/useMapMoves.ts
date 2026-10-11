import { useCallback } from 'react';
import type { MapView } from '../SiteMap';
import type { LocateState } from './useLocate';
import type { useMapSelection } from './useMapSelection';
import type { SiteBrowser } from './useSiteBrowser';

interface MoveSources {
  readonly view: MapView | null;
  readonly setView: (view: MapView) => void;
  readonly selection: Pick<ReturnType<typeof useMapSelection>, 'frame'>;
  readonly location: LocateState;
  readonly browser: Pick<SiteBrowser, 'visible' | 'follow'>;
}

/**
 * The person's own moves: the map's view as it changes, "Show my location" (asks, then flies there) and
 * "Go to my location" for a fix read quietly on open or taken at start, which never moves the map by itself.
 */
export function useMapMoves({ view, setView, selection, location, browser }: MoveSources) {
  const { frame } = selection;
  const { position, locate } = location;
  const { visible, follow } = browser;
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
  return { onViewChange, locateMe, goToMe, away };
}
