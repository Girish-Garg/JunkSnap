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

// --text and --text-secondary from src/ui/tokens.css, light and dark; MapLibre needs plain values.
const TEXT_COLORS = {
  light: { name: '#221c15', value: '#5f5446' },
  dark: { name: '#f7f0e4', value: '#c9bdaa' },
} as const;

/** Name, then the shown score or report count as a bare number (the badge glyph says which); else the name. */
export function markerText(dark: boolean): ExpressionSpecification {
  const colors = TEXT_COLORS[dark ? 'dark' : 'light'];
  const bold: ExpressionSpecification = ['literal', ['Noto Sans Bold']];
  const name = { 'text-font': bold, 'text-color': colors.name };
  return [
    'case',
    ['has', 'marker_value'],
    ['format', ['get', 'name'], name, '\n', {}, ['get', 'marker_value'], { 'font-scale': 0.9, 'text-color': colors.value }],
    ['format', ['get', 'name'], name],
  ];
}

/**
 * Each area's marker: a small badge at its pole of inaccessibility with its name, a score or photo glyph
 * and a number (no words: MapLibre cannot shape Devanagari; the tooltip and legend carry them). Collisions
 * hide the later markers; the worst areas place first (marker_rank). Larger as the map zooms in.
 */
export class AreaMarkerLayer implements BoundaryLayer {
  readonly id = 'boundary-marker';
  readonly onTop = true;

  spec({ labelSource, dark }: BoundaryContext): LayerSpecification {
    return {
      id: this.id,
      type: 'symbol',
      source: labelSource,
      minzoom: MARKER_MIN_ZOOM,
      layout: {
        'text-field': markerText(dark),
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
