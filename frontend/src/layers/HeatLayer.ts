import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import type { LayerContext, MapLayer } from './MapLayer';

// Half from verified reports, half from all reports; size_class and hazards join once insights exist.
const WEIGHT: ExpressionSpecification = [
  '+',
  ['*', 0.5, ['min', 1, ['/', ['get', 'verified_count'], 5]]],
  ['*', 0.5, ['min', 1, ['/', ['get', 'report_count'], 10]]],
];

// Sequential ramp: transparent, then the teal accent family, then deep red for hotspots.
const RAMP: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0,
  'rgba(11, 110, 99, 0)',
  0.25,
  'rgba(11, 110, 99, 0.3)',
  0.5,
  'rgba(11, 110, 99, 0.55)',
  0.75,
  'rgba(197, 34, 31, 0.7)',
  1,
  'rgba(140, 20, 18, 0.85)',
];

// Auto mode fades heat out between MapLibre zoom 11 and 12 (Google's 12 and 13) while pins fade in.
const AUTO_OPACITY: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 11, 0.85, 12, 0];

export default class HeatLayer implements MapLayer {
  readonly id = 'site-heat';
  readonly order = 10;
  readonly interactive = false;

  spec({ sourceId, mode }: LayerContext): LayerSpecification {
    return {
      id: this.id,
      type: 'heatmap',
      source: sourceId,
      layout: { visibility: mode === 'pins' ? 'none' : 'visible' },
      paint: {
        'heatmap-weight': WEIGHT,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 12, 3],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 14, 9, 28, 12, 40],
        'heatmap-color': RAMP,
        'heatmap-opacity': mode === 'auto' ? AUTO_OPACITY : 0.85,
      },
    };
  }
}
