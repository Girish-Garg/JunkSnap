import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import type { LayerContext, MapLayer } from './MapLayer';

// A 1 km radius in screen pixels: metres per pixel halve with each zoom step (Web Mercator at about 26 deg N).
const PX_AT_ZOOM_0 = 1000 / (156543.03 * Math.cos((26 * Math.PI) / 180));
const RADIUS: ExpressionSpecification = ['interpolate', ['exponential', 2], ['zoom'], 0, PX_AT_ZOOM_0, 22, PX_AT_ZOOM_0 * 2 ** 22];

/** No-bin zones as a soft 1 km circle under the pins (decision 20261010-1630); verified ones are a little stronger. */
export default class ZonesLayer implements MapLayer {
  readonly id = 'nobin-zones';
  readonly order = 15;
  readonly interactive = false;

  spec({ sourceId, mode }: LayerContext): LayerSpecification {
    const verified: ExpressionSpecification = ['==', ['get', 'verification'], 'verified'];
    return {
      id: this.id,
      type: 'circle',
      source: sourceId,
      filter: ['==', ['get', 'report_type'], 'no_bin'],
      layout: { visibility: mode === 'heat' ? 'none' : 'visible' },
      paint: {
        'circle-radius': RADIUS,
        // MapLibre cannot read CSS variables: the --type-nobin value.
        'circle-color': '#e37400',
        'circle-opacity': ['case', verified, 0.16, 0.08],
        'circle-stroke-color': '#e37400',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': ['case', verified, 0.6, 0.35],
        'circle-pitch-alignment': 'map',
      },
    };
  }
}
