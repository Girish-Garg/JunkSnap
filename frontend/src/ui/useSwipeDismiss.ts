import { useEffect, useState } from 'react';
import { CardSwipe } from './CardSwipe';

/** Lets a floating card follow a finger down and dismiss on a far or fast release; the card reads --card-drag. */
export function useSwipeDismiss(onDismiss: () => void): CardSwipe {
  const [swipe] = useState(() => new CardSwipe());
  useEffect(() => swipe.bind(onDismiss), [swipe, onDismiss]);
  return swipe;
}
