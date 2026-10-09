import type { LayerSpecification } from 'maplibre-gl';
import { INK } from '../ui/palette';
import { CLUSTERS, type MapLayer } from './MapLayer';

// Fonts must exist on the style's glyph server (OpenFreeMap serves Noto Sans).
const FONT = ['Noto Sans Bold'];

export default class ClusterCountLayer implements MapLayer {
  readonly id = 'site-cluster-counts';
  readonly order = 11;
  readonly interactive = false;

  spec(sourceId: string): LayerSpecification {
    return {
      id: this.id,
      type: 'symbol',
      source: sourceId,
      filter: CLUSTERS,
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': FONT,
        'text-size': 13,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': INK },
    };
  }
}
