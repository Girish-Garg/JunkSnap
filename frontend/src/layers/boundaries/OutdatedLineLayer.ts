import type { LayerSpecification } from 'maplibre-gl';
import { OUTDATED_COLOR, type BoundaryContext, type BoundaryLayer } from './BoundaryLayer';
import { LINE_WIDTH } from './BoundaryLineLayer';

/** Seats whose boundary predates a re-delimitation (status outdated): dashed and grey. */
export class OutdatedLineLayer implements BoundaryLayer {
  readonly id = 'boundary-line-outdated';
  readonly onTop = false;

  spec({ polygonSource }: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'line',
      source: polygonSource,
      filter: ['==', ['get', 'status'], 'outdated'],
      paint: {
        'line-color': OUTDATED_COLOR,
        'line-width': LINE_WIDTH,
        'line-dasharray': [2, 2],
      },
    };
  }
}
