import { useCallback, useRef, useState } from 'react';

/** A horizontal scroll-snap track of cards: swipe natively, or step with the buttons and dots. */
export function useCardDeck(count: number) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const onScroll = useCallback(() => {
    const element = track.current;
    if (!element || element.clientWidth === 0) return;
    setIndex(Math.min(Math.round(element.scrollLeft / element.clientWidth), count - 1));
  }, [count]);
  const go = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(next, count - 1));
      setIndex(target);
      const element = track.current;
      element?.scrollTo?.({ left: target * element.clientWidth, behavior: 'smooth' });
    },
    [count],
  );
  const deck = { index, count, last: index === count - 1, onScroll, go };
  return [track, deck] as const;
}

export type CardDeck = ReturnType<typeof useCardDeck>[1];
