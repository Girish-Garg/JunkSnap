import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * --area-tint-1 to --area-tint-8 in src/ui/tokens.css, light and dark (MapLibre paint needs plain values; a test
 * keeps the two in step). Greyed ochre, olive, teal, slate, mauve, clay, stone and rose, spread round the wheel
 * so no one hue dominates, and none near saffron, green, blue or red above HSL saturation 0.55; drawn at about
 * 15% they only tell neighbours apart. Why these: frontend/DESIGN.md.
 */
export const AREA_TINTS = {
  light: ['#a38a4e', '#7a8f22', '#1f8f86', '#4a6fa8', '#9c4f93', '#b0603a', '#706b5f', '#c4567a'],
  dark: ['#cdb47a', '#b7c25a', '#5fc6bb', '#8cabd6', '#d495c4', '#c99a7c', '#b5b0a3', '#d993a6'],
} as const;

export const TINT_COUNT = AREA_TINTS.light.length;

// Light enough that streets, names and pins stay on top; a shown score's colour is stronger (BoundaryFillLayer).
export const TINT_OPACITY = { far: 0.15, near: 0.12 } as const;

const NONE = 'rgba(0, 0, 0, 0)';

/** The area's neighbour tint from its `tint` feature state (a slot from AreaColouring); none without one. */
export function tintColor(dark: boolean): ExpressionSpecification {
  const palette = AREA_TINTS[dark ? 'dark' : 'light'];
  const stops = palette.flatMap((color, slot) => [slot, color]);
  return ['match', ['feature-state', 'tint'], ...stops, NONE] as unknown as ExpressionSpecification;
}

/** Score colour where the api shows a score (`fill`), else the neighbour tint. */
export function fillColor(dark: boolean): ExpressionSpecification {
  return ['coalesce', ['feature-state', 'fill'], tintColor(dark)];
}
