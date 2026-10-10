import type { Map as MapLibreMap, Point } from 'maplibre-gl';
import type { LayerRegistry } from '../../layers/LayerRegistry';
import { PinFeatures, type PinHit } from './PinFeatures';

// About a fingertip: a tap this close to a pin picks it.
const TAP_TOLERANCE_PX = 16;

/** Finds the topmost site pin or stack under a tap. */
export class PinPicker {
  readonly #map: MapLibreMap;
  readonly #layers: LayerRegistry;

  constructor(map: MapLibreMap, layers: LayerRegistry) {
    this.#map = map;
    this.#layers = layers;
  }

  at(point: Point): PinHit | null {
    const box: [[number, number], [number, number]] = [
      [point.x - TAP_TOLERANCE_PX, point.y - TAP_TOLERANCE_PX],
      [point.x + TAP_TOLERANCE_PX, point.y + TAP_TOLERANCE_PX],
    ];
    const layers = this.#layers.interactiveIds().filter((id) => this.#map.getLayer(id));
    const [hit] = this.#map.queryRenderedFeatures(box, { layers });
    return PinFeatures.hit(hit?.properties);
  }
}
