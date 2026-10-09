import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { ACCENT } from '../ui/palette';
import { SINGLE_SITES, type MapLayer } from './MapLayer';

const SELECTED: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];

/** SiteMap sets feature-state `selected`. */
export default class SelectedSiteLayer implements MapLayer {
  readonly id = 'site-selected';
  readonly order = 20;
  readonly interactive = false;

  spec(sourceId: string): LayerSpecification {
    return {
      id: this.id,
      type: 'circle',
      source: sourceId,
      filter: SINGLE_SITES,
      paint: {
        'circle-radius': 20,
        'circle-color': '#ffffff',
        'circle-opacity': ['case', SELECTED, 1, 0],
        'circle-stroke-color': ACCENT,
        'circle-stroke-width': 3,
        'circle-stroke-opacity': ['case', SELECTED, 1, 0],
      },
    };
  }
}
