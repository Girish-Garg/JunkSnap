/** The attribute every sheet and dialog carries; the last one in the page is the topmost. */
export const LAYER_ATTRIBUTE = 'data-escape-layer';

/** Marks a layer that floats over the map without covering it (the pin preview card): map taps pass through. */
export const MAP_CARD_ATTRIBUTE = 'data-map-card';

const COVERING = `[${LAYER_ATTRIBUTE}]:not([${MAP_CARD_ATTRIBUTE}])`;

const DISMISS_EVENT = 'junksnap:dismiss-top';

/**
 * The topmost sheet or dialog: the last [data-escape-layer] in the page, which also paints on top and owns the
 * top history entry. A map tap asks it to close the same way Escape does, so it plays its closing animation
 * and pops exactly one level.
 */
export class TopLayer {
  static readonly event = DISMISS_EVENT;

  /** How many sheets or dialogs cover the map; the preview card does not count. */
  static covering(): number {
    return document.querySelectorAll(COVERING).length;
  }

  static is(element: HTMLElement | null): boolean {
    const layers = document.querySelectorAll(`[${LAYER_ATTRIBUTE}]`);
    return element !== null && layers[layers.length - 1] === element;
  }

  static dismiss(): void {
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }
}
