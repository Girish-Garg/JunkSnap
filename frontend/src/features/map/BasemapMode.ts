import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import { BasemapTheme } from './BasemapTheme';

type PaintName = Parameters<MapLibreMap['setPaintProperty']>[1];
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2];

// Positron's vector source; boundary and site layers have their own sources and keep their colours.
const BASEMAP_SOURCE = 'openmaptiles';

/** Light or dark basemap colours. A switch while the style is still loading is applied once the map is idle. */
export class BasemapMode {
  readonly #map: MapLibreMap;
  #dark = false;
  #painted = false;

  constructor(map: MapLibreMap) {
    this.#map = map;
  }

  /** For setStyle's transformStyle: the first paint already has the right colours. */
  transform(style: StyleSpecification): StyleSpecification {
    this.#painted = this.#dark;
    return BasemapTheme.apply(style, this.#dark);
  }

  setDark(dark: boolean): void {
    this.#dark = dark;
    this.#repaint();
  }

  #repaint(): void {
    if (this.#painted === this.#dark) return;
    if (!this.#map.isStyleLoaded()) {
      this.#map.once('idle', () => this.#repaint());
      return;
    }
    const dark = this.#dark;
    for (const layer of this.#map.getStyle().layers) {
      const basemap = layer.type === 'background' || ('source' in layer && layer.source === BASEMAP_SOURCE);
      if (!basemap) continue;
      for (const [name, value] of Object.entries(BasemapTheme.paint(layer, dark))) {
        this.#map.setPaintProperty(layer.id, name as PaintName, value as PaintValue);
      }
    }
    this.#painted = dark;
  }
}
