import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { LINE_COLOR, type BoundaryContext, type BoundaryLayer } from './BoundaryLayer';

const OUTDATED: ExpressionSpecification = ['==', ['get', 'status'], 'outdated'];

// Thin when zoomed out, clear at the city view (12) and closer.
export const LINE_WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 1, 12, 1.5, 15, 2.5];

/** Edges of current areas; outdated Lok Sabha seats are drawn by OutdatedLineLayer instead. */
export class BoundaryLineLayer implements BoundaryLayer {
  readonly id = 'boundary-line';
  readonly onTop = false;

  spec({ polygonSource }: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'line',
      source: polygonSource,
      filter: ['!', OUTDATED],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': LINE_COLOR, 'line-width': LINE_WIDTH, 'line-opacity': 0.8 },
    };
  }
}
