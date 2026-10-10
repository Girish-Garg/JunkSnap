import type { LayerSpecification } from 'maplibre-gl';
import { LABEL_MIN_ZOOM, LINE_COLOR, type BoundaryContext, type BoundaryLayer } from './BoundaryLayer';

/** Area names at one point inside each area, from the zoom where the areas are large on screen. */
export class BoundaryLabelLayer implements BoundaryLayer {
  readonly id = 'boundary-label';
  readonly onTop = true;

  spec({ kind, labelSource }: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'symbol',
      source: labelSource,
      minzoom: LABEL_MIN_ZOOM[kind],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
        'text-max-width': 8,
      },
      paint: { 'text-color': LINE_COLOR, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    };
  }
}
