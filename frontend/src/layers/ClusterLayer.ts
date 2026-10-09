import type { LayerSpecification } from 'maplibre-gl';
import { INK } from '../ui/palette';
import { CLUSTERS, type MapLayer } from './MapLayer';

export default class ClusterLayer implements MapLayer {
  readonly id = 'site-clusters';
  readonly order = 10;
  readonly interactive = true;

  spec(sourceId: string): LayerSpecification {
    return {
      id: this.id,
      type: 'circle',
      source: sourceId,
      filter: CLUSTERS,
      paint: {
        'circle-color': '#ffffff',
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 24],
        'circle-stroke-color': INK,
        'circle-stroke-width': 2,
      },
    };
  }
}
