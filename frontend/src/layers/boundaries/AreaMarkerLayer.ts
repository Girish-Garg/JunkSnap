import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { MARKER_MIN_ZOOM, type BoundaryContext, type BoundaryLayer } from './BoundaryLayer';

/** Badge image names by marker basis; score and count badges carry a glyph left of the text. */
export const BADGE_IMAGES = { plain: 'area-badge', score: 'area-badge-score', count: 'area-badge-count' } as const;

const BADGE: ExpressionSpecification = [
  'match',
  ['get', 'marker_basis'],
  'score',
  BADGE_IMAGES.score,
  'count',
  BADGE_IMAGES.count,
  BADGE_IMAGES.plain,
];

// Same as --text and --text-secondary in theme.css; MapLibre paint needs plain values.
const NAME_COLOR = '#1f1f1f';
const VALUE_COLOR = '#5f6368';

// Name, then the shown score or report count as a bare number (the badge glyph says which); else the name.
const TEXT: ExpressionSpecification = [
  'case',
  ['has', 'marker_value'],
  [
    'format',
    ['get', 'name'],
    { 'text-font': ['literal', ['Noto Sans Bold']], 'text-color': NAME_COLOR },
    '\n',
    {},
    ['get', 'marker_value'],
    { 'font-scale': 0.9, 'text-color': VALUE_COLOR },
  ],
  ['format', ['get', 'name'], { 'text-font': ['literal', ['Noto Sans Bold']], 'text-color': NAME_COLOR }],
];

/**
 * Each area's marker: a small badge at its pole of inaccessibility with its name, a score or photo glyph
 * and a number (no words: MapLibre cannot shape Devanagari; the tooltip and legend carry them). Collisions
 * hide the later markers; the worst areas place first (marker_rank). Larger as the map zooms in.
 */
export class AreaMarkerLayer implements BoundaryLayer {
  readonly id = 'boundary-marker';
  readonly onTop = true;

  spec({ labelSource }: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'symbol',
      source: labelSource,
      minzoom: MARKER_MIN_ZOOM,
      layout: {
        'text-field': TEXT,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 15, 14],
        'text-max-width': 10,
        'text-line-height': 1.25,
        'icon-image': BADGE,
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [3, 6, 3, 2],
        'symbol-sort-key': ['coalesce', ['get', 'marker_rank'], 9999],
        'text-allow-overlap': false,
        'icon-allow-overlap': false,
        'text-padding': 4,
      },
    };
  }
}
