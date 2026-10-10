import { useCallback, useState, type UIEvent } from 'react';

export interface StripIndex {
  readonly index: number;
  readonly onScroll: (event: UIEvent<HTMLElement>) => void;
}

/** Which photo of a snapping strip is in view, for the "1 / 4" badge. */
export function useStripIndex(count: number): StripIndex {
  const [index, setIndex] = useState(0);
  const onScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      const list = event.currentTarget;
      const first = list.firstElementChild;
      const step = first instanceof HTMLElement ? first.offsetWidth : 0;
      if (step <= 0) return;
      const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
      setIndex(atEnd ? count - 1 : Math.min(count - 1, Math.round(list.scrollLeft / step)));
    },
    [count],
  );
  return { index: Math.min(index, Math.max(0, count - 1)), onScroll };
}
