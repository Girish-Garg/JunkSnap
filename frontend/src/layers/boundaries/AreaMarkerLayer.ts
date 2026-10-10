import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl';
import { MARKER_MIN_ZOOM, type BoundaryContext, type BoundaryLayer, type ThemedProperties } from './BoundaryLayer';

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

/** Images drawn inside a marker's text after a shown score: the photo glyph of its count, and the pilot flag. */
export const INLINE_IMAGES = { count: 'area-glyph-count', pilot: 'area-glyph-pilot' } as const;

/**
 * Name, then the shown score or report count as a bare number (the badge glyph says which). A shown score also
 * carries its verified report count and, on pilot-city data, the pilot flag. Else the name alone.
 */
export function markerText(dark: boolean): ExpressionSpecification {
  const colors = TEXT_COLORS[dark ? 'dark' : 'light'];
  const bold: ExpressionSpecification = ['literal', ['Noto Sans Bold']];
  const head = [['get', 'name'], { 'text-font': bold, 'text-color': colors.name }, '\n', {}];
  const value = { 'font-scale': 0.9, 'text-color': colors.value };
  const scored = [...head, ['get', 'marker_value'], value, '  ', {}, ['image', INLINE_IMAGES.count], {}, ['get', 'marker_count'], value];
  const pilot = [' ', {}, ['image', INLINE_IMAGES.pilot], {}];
  return [
    'case',
    ['all', ['has', 'marker_count'], ['has', 'marker_pilot']],
    ['format', ...scored, ...pilot],
    ['has', 'marker_count'],
    ['format', ...scored],
    ['has', 'marker_value'],
    ['format', ...head, ['get', 'marker_value'], value],
    ['format', ['get', 'name'], { 'text-font': bold, 'text-color': colors.name }],
  ] as ExpressionSpecification;
}

/** No area id matches it: the focus marker's filter while nothing is in focus. */
export const NO_AREA = '';

/** Every marker but the one in focus, or only the one in focus. */
export function markerFilter(focus: boolean, id: string | null): FilterSpecification {
  return [focus ? '==' : '!=', ['get', 'id'], id ?? NO_AREA];
}

// The focus marker shows from a state-wide view and never gives way to another marker.
const FOCUS_MIN_ZOOM = 5;

/**
 * Each area's marker: a small badge at its pole of inaccessibility with its name, a score or photo glyph
 * and a number (no words: MapLibre cannot shape Devanagari; the tooltip and legend carry them). Collisions
 * hide the later markers; the worst areas place first (marker_rank). Larger as the map zooms in.
 * The focus variant draws the same badge for the area in focus alone, always shown, over the others.
 */
export class AreaMarkerLayer implements BoundaryLayer {
  readonly id: string;
  readonly onTop = true;
  readonly #focus: boolean;

  constructor(focus = false) {
    this.#focus = focus;
    this.id = focus ? 'boundary-marker-focus' : 'boundary-marker';
  }

  themed(dark: boolean): ThemedProperties {
    return { layout: [['text-field', markerText(dark)]] };
  }

  spec({ labelSource, dark }: BoundaryContext): LayerSpecification {
    const focus = this.#focus;
    return {
      id: this.id,
      type: 'symbol',
      source: labelSource,
      minzoom: focus ? FOCUS_MIN_ZOOM : MARKER_MIN_ZOOM,
      filter: markerFilter(focus, null),
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
        'text-allow-overlap': focus,
        'icon-allow-overlap': focus,
        'text-padding': 4,
      },
    };
  }
}
