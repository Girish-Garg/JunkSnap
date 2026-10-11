import { useLayoutEffect, type RefObject } from 'react';

/** The map page reads this to lift its controls above whichever card floats over the map. */
export const CARD_HEIGHT_VAR = '--card-height';

/**
 * Publishes a floating map card's measured height on its map page as --card-height, kept current by a
 * ResizeObserver (Hindi, larger text, a reason line), so `.map-page--card .map-controls` clears any card. It
 * publishes before paint, so the controls never show behind a new card.
 */
export function useCardHeight(card: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = card.current;
    const page = element?.closest<HTMLElement>('.map-page');
    if (!element || !page) return undefined;
    const publish = () => page.style.setProperty(CARD_HEIGHT_VAR, `${element.offsetHeight}px`);
    publish();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(publish) : null;
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      page.style.removeProperty(CARD_HEIGHT_VAR);
    };
  }, [card]);
}
