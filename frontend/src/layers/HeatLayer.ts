import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import type { LayerContext, MapLayer } from './MapLayer';

// PinFeatures adds heat_weight from domain/HeatWeight: 0.4 for any site on the map, up to 1.
const WEIGHT: ExpressionSpecification = ['coalesce', ['get', 'heat_weight'], 0.4];

// Sequential ramp. MapLibre cannot read CSS variables: --accent (11 122 115), --type-dump and --error.
// A lone fresh site peaks near density 0.4 (weight 0.4 x intensity 2.5 x MapLibre's kernel peak 0.4): solid teal.
const RAMP: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0,
  'rgba(11, 122, 115, 0)',
  0.1,
  'rgba(11, 122, 115, 0.3)',
  0.4,
  'rgba(11, 122, 115, 0.6)',
  0.7,
  'rgba(197, 34, 31, 0.75)',
  1,
  'rgba(179, 38, 30, 0.9)',
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
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 5, 2, 12, 2.5],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 5, 14, 9, 28, 12, 40],
        'heatmap-color': RAMP,
        'heatmap-opacity': mode === 'auto' ? AUTO_OPACITY : 0.85,
      },
    };
  }
}
