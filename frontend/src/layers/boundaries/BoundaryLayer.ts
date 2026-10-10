import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

type Paint = Parameters<MapLibreMap['setPaintProperty']>;
type Layout = Parameters<MapLibreMap['setLayoutProperty']>;

/** What an area layer needs: the ids of the polygon and marker sources. */
export interface BoundaryContext {
  readonly polygonSource: string;
  readonly labelSource: string;
  /** The app's dark theme: markers use their dark badge and light text. */
  readonly dark: boolean;
}

/** Paint and layout values that follow the theme, set in place when it changes. */
export interface ThemedProperties {
  readonly paint?: readonly (readonly [Paint[1], Paint[2]])[];
  readonly layout?: readonly (readonly [Layout[1], Layout[2]])[];
}

/** One MapLibre layer of the map's areas (assembly seats where they exist, Lok Sabha seats elsewhere). */
export interface BoundaryLayer {
  readonly id: string;
  /** Marker layers sit above the basemap labels; fills and lines sit under them. */
  readonly onTop: boolean;
  spec(context: BoundaryContext): LayerSpecification;
  /** The values to swap when the theme turns light or dark; layers that look the same in both have none. */
  themed?(dark: boolean): ThemedProperties;
}

// Markers show once seats are a fair size on screen (MapLibre zooms); collisions thin them out.
export const MARKER_MIN_ZOOM = 8;

// --text-secondary in tokens.css, light and dark: edges read clearly on the sand and the charcoal basemap.
export const LINE_COLORS = { light: '#5f5446', dark: '#c9bdaa' } as const;
// --accent in tokens.css, light and dark: the selected area, or the one the person stands in.
export const FOCUS_COLORS = { light: '#0b7a73', dark: '#3cc7b8' } as const;
export const OUTDATED_COLOR = '#9aa0a6';
