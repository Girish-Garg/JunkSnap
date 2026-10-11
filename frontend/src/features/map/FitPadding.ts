import type { PaddingOptions } from 'maplibre-gl';
import { MAP_DEFAULTS, type MapSettings } from '../../config/MapSettings';
import { CARD_HEIGHT_VAR } from '../../ui/useCardHeight';
import { DESKTOP_QUERY } from '../../ui/useMediaQuery';

/** What covers the map's ends on a phone, in pixels from the map's top. */
export interface MapCover {
  readonly height: number;
  /** Bottom of the search and Filters stack. */
  readonly stack: number;
  /** A card standing on the map foot (--card-height), or 0. */
  readonly card: number;
}

/**
 * The plain padding of a fit, the room left round its points once a card is up (tighter on a short phone), and the
 * share of the map's height that must stay free, below which a fit would squeeze the points into a sliver.
 */
export type FitRules = Pick<MapSettings, 'fitPaddingPx' | 'fitTightPx' | 'fitMinFree'>;

/**
 * Padding for fitting points (Zoom out, a stack of sites): with a card on the map foot, the points land between the
 * search stack and the card, so none hides under either; otherwise, or with no room for that, the plain 80 px.
 */
export class FitPadding {
  static between({ height, stack, card }: MapCover, rules: FitRules = MAP_DEFAULTS): number | PaddingOptions {
    const { fitPaddingPx: padding, fitTightPx: tightPx, fitMinFree } = rules;
    if (card <= 0) return padding;
    const edge = padding / 2;
    const roomy = { top: stack + edge, bottom: card + padding, left: edge, right: edge };
    const tight = { top: stack + tightPx, bottom: card + tightPx, left: tightPx, right: tightPx };
    return [roomy, tight].find(({ top, bottom }) => height - top - bottom >= height * fitMinFree) ?? padding;
  }

  /** Reads the cover from the phone's map page around the container (map.css, useCardHeight); desktop has none. */
  static of(container: HTMLElement, rules: FitRules = MAP_DEFAULTS): number | PaddingOptions {
    const page = container.closest<HTMLElement>('.map-page');
    if (!page || window.matchMedia?.(DESKTOP_QUERY).matches) return rules.fitPaddingPx;
    const box = container.getBoundingClientRect();
    const stack = page.querySelector('.search-area')?.getBoundingClientRect().bottom ?? box.top;
    const card = Number.parseFloat(page.style.getPropertyValue(CARD_HEIGHT_VAR)) || 0;
    return FitPadding.between({ height: box.height, stack: Math.max(stack - box.top, 0), card }, rules);
  }
}
