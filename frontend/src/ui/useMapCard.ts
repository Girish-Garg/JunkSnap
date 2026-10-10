import { useRef } from 'react';
import { useCardHeight } from './useCardHeight';
import { useEscapeKey } from './useEscapeKey';
import { useSwipeDismiss } from './useSwipeDismiss';

/**
 * What every card floating over the map needs: Escape and a map tap close it when it is the top layer, a swipe down
 * closes it, and its height lifts the map controls (--card-height). The caller puts `card` on its root element.
 */
export function useMapCard(onClose: () => void) {
  const card = useRef<HTMLElement>(null);
  useEscapeKey(onClose, card);
  useCardHeight(card);
  const swipe = useSwipeDismiss(onClose);
  return { card, swipe };
}
