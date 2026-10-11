import { useCallback } from 'react';
import { useHistoryLayer } from '../../../ui/useHistoryLayer';
import type { MapPageState } from './useMapPage';

/**
 * The one history level the map's picks share: a pin's preview card, a stack pin's list and an area's card. A pick
 * that replaces another (a pin tapped with an area's card up) keeps the level, so back closes whichever is up and
 * leaves no dead entry behind. Returns `dismiss`, which closes it through history.
 */
export function usePickLayer({ selection, areaCard }: Pick<MapPageState, 'selection' | 'areaCard'>) {
  const { preview, stack, clearPick } = selection;
  const { area, clear } = areaCard;
  const close = useCallback(() => {
    clearPick();
    clear();
  }, [clearPick, clear]);
  return useHistoryLayer('pick', Boolean(stack ?? preview ?? area), close);
}
