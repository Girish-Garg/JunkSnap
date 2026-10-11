import type { ErrorEvent, Map as MapLibreMap } from 'maplibre-gl';
import { BASEMAP_SOURCE } from './BasemapMode';

/** What the basemap is doing: fetching its style and first tiles, drawn, or stopped by a failed fetch. */
export type BasemapSignal = 'loading' | 'loaded' | 'failed';

/**
 * Follows one basemap load at a time. MapLibre fires `load` once, right after the first frame drawn with the
 * style, its sprite and every tile in view (a failed tile counts as done); a reload after that ends at the next
 * `idle`, the same check on a later frame. Only the style itself and the basemap source's TileJSON stop a load:
 * one failed tile or glyph still lets the map draw.
 */
export class BasemapWatch {
  readonly #styleUrl: string;
  readonly #onSignal: (signal: BasemapSignal) => void;
  #waiting = false;
  /** The current style has been read; MapLibre fires `styledataloading` as one starts and `style.load` once in. */
  #styled = false;

  constructor(map: MapLibreMap, styleUrl: string, onSignal: (signal: BasemapSignal) => void) {
    this.#styleUrl = styleUrl;
    this.#onSignal = onSignal;
    map.on('load', () => this.#settle('loaded'));
    map.on('idle', () => this.#settle('loaded'));
    map.on('styledataloading', () => (this.#styled = false));
    map.on('style.load', () => (this.#styled = true));
    // With a listener here MapLibre no longer logs errors itself, so whatever does not stop the load is logged.
    map.on('error', (event) => {
      if (this.#waiting && this.#stops(event)) this.#settle('failed');
      else console.error(event.error);
    });
  }

  /** Call just before each setStyle: a new load starts. */
  start(): void {
    this.#waiting = true;
    this.#onSignal('loading');
  }

  #settle(signal: 'loaded' | 'failed'): void {
    if (!this.#waiting) return;
    this.#waiting = false;
    this.#onSignal(signal);
  }

  // MapLibre adds `tile` to a tile's error and `sourceId` to a source's, and a failed fetch (AJAXError) carries its
  // url. Any other error before the style is read is the style's: a captive portal's HTML that is not JSON, say.
  #stops(event: ErrorEvent): boolean {
    if ('tile' in event) return false;
    if ('sourceId' in event) return event.sourceId === BASEMAP_SOURCE;
    if ('url' in event.error) return event.error.url === this.#styleUrl;
    return !this.#styled;
  }
}
