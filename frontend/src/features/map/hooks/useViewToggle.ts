import { useCallback } from 'react';
import { HistoryLayers } from '../../../ui/HistoryLayers';

export type MapOrList = 'map' | 'list';

/**
 * What the Map / List toggle does, always through history so back stays one level per sheet. List opens the list
 * (closing a pin's card or stack list first); with the list open under a site's card, List goes back to it.
 * Map leaves the list and any card picked from it.
 */
export function useViewToggle(listOpen: boolean, openList: () => void) {
  const pick = useCallback(
    (view: MapOrList) => {
      if (view === 'map') {
        if (listOpen) HistoryLayers.unwind(() => undefined);
      } else if (listOpen) {
        HistoryLayers.back();
      } else {
        HistoryLayers.unwind(openList);
      }
    },
    [listOpen, openList],
  );
  return { current: (listOpen ? 'list' : 'map') as MapOrList, pick };
}
