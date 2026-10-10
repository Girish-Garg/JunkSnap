import type { LayerSpecification } from 'maplibre-gl';
import type { BoundaryContext, BoundaryLayer } from './BoundaryLayer';

/** The choropleth: each area's colour comes from ChoroplethScale through feature state; no data, no fill. */
export class BoundaryFillLayer implements BoundaryLayer {
  readonly id = 'boundary-fill';
  readonly onTop = false;

  spec({ polygonSource }: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'fill',
      source: polygonSource,
      paint: {
        'fill-color': ['coalesce', ['feature-state', 'fill'], 'rgba(0, 0, 0, 0)'],
        // Lighter as streets and pins take over.
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 15, 0.3],
      },
    };
  }
}
