import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { fillColor, TINT_OPACITY } from './AreaTints';
import type { BoundaryContext, BoundaryLayer, ThemedProperties } from './BoundaryLayer';

const SCORED: ExpressionSpecification = ['boolean', ['feature-state', 'scored'], false];
// A shown score is a little stronger than a tint but stays a wash, so a scored seat never reads as an alarm.
const SCORE_OPACITY = { far: 0.3, near: 0.22 } as const;

/**
 * Every area filled: a soft neighbour tint (AreaColouring through `tint` feature state) so one area reads apart
 * from the next, or, once the api shows a score (10+ verified reports), its ChoroplethScale colour (`fill`).
 */
export class BoundaryFillLayer implements BoundaryLayer {
  readonly id = 'boundary-fill';
  readonly onTop = false;

  spec(context: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'fill',
      source: context.polygonSource,
      paint: {
        'fill-color': fillColor(context.dark),
        // Lighter as streets and pins take over; tints stay faint at every zoom.
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, ['case', SCORED, SCORE_OPACITY.far, TINT_OPACITY.far], 15, ['case', SCORED, SCORE_OPACITY.near, TINT_OPACITY.near]],
      },
    };
  }

  themed(dark: boolean): ThemedProperties {
    return { paint: [['fill-color', fillColor(dark)]] };
  }
}
