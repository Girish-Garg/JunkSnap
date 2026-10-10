import type { LayerSpecification } from 'maplibre-gl';
import { FOCUS_COLORS, type BoundaryContext, type BoundaryLayer, type ThemedProperties } from './BoundaryLayer';

/**
 * A thick accent outline round the area in focus: the one tapped, the one whose page is open, else the one the
 * person stands in. Drawn for every area and shown only where the `focus` feature state is set.
 */
export class FocusLineLayer implements BoundaryLayer {
  readonly id = 'boundary-line-focus';
  readonly onTop = false;

  spec(context: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'line',
      source: context.polygonSource,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': FocusLineLayer.#color(context.dark),
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 3, 14, 4.5],
        'line-opacity': ['case', ['boolean', ['feature-state', 'focus'], false], 1, 0],
      },
    };
  }

  themed(dark: boolean): ThemedProperties {
    return { paint: [['line-color', FocusLineLayer.#color(dark)]] };
  }

  static #color(dark: boolean): string {
    return FOCUS_COLORS[dark ? 'dark' : 'light'];
  }
}
