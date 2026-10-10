import { useEffect, type RefObject } from 'react';

/**
 * On mount, scrolls the list's [aria-current] item into view (back from the map, the row last opened). A block body:
 * newer browsers return a promise from scrollIntoView, and an effect may only return a cleanup.
 */
export function useScrollToCurrent(list: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    void list.current?.querySelector('[aria-current]')?.scrollIntoView?.({ block: 'nearest' });
  }, [list]);
}
