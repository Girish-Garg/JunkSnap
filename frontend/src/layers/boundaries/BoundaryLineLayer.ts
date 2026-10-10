import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { LINE_COLORS, type BoundaryContext, type BoundaryLayer, type ThemedProperties } from './BoundaryLayer';

const OUTDATED: ExpressionSpecification = ['==', ['get', 'status'], 'outdated'];

// Thin when zoomed out, clear at the city view (12) and closer.
export const LINE_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 1.1, 12, 1.6, 15, 2.5];

/** Edges of current areas; outdated Lok Sabha seats are drawn by OutdatedLineLayer instead. */
export class BoundaryLineLayer implements BoundaryLayer {
  readonly id = 'boundary-line';
  readonly onTop = false;

  spec(context: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'line',
      source: context.polygonSource,
      filter: ['!', OUTDATED],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': BoundaryLineLayer.#color(context.dark), 'line-width': LINE_WIDTH, 'line-opacity': 0.7 },
    };
  }

  themed(dark: boolean): ThemedProperties {
    return { paint: [['line-color', BoundaryLineLayer.#color(dark)]] };
  }

  static #color(dark: boolean): string {
    return LINE_COLORS[dark ? 'dark' : 'light'];
  }
}
