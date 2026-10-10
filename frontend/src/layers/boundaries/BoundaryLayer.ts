import type { LayerSpecification } from 'maplibre-gl';

/** What an area layer needs: the ids of the polygon and marker sources. */
export interface BoundaryContext {
  readonly polygonSource: string;
  readonly labelSource: string;
}

/** One MapLibre layer of the map's areas (assembly seats where they exist, Lok Sabha seats elsewhere). */
export interface BoundaryLayer {
  readonly id: string;
  /** Marker layers sit above the basemap labels; fills and lines sit under them. */
  readonly onTop: boolean;
  spec(context: BoundaryContext): LayerSpecification;
}

// Markers show once seats are a fair size on screen (MapLibre zooms); collisions thin them out.
export const MARKER_MIN_ZOOM = 8;

// Same as --text-secondary and --divider in theme.css; MapLibre paint needs plain values.
export const LINE_COLOR = '#5f6368';
export const OUTDATED_COLOR = '#9aa0a6';
