import type { LayerSpecification } from 'maplibre-gl';
import type { BoundaryKind } from '../../domain/AreaListing';

/** What a boundary layer needs: which kind is shown and the ids of its polygon and label sources. */
export interface BoundaryContext {
  readonly kind: BoundaryKind;
  readonly polygonSource: string;
  readonly labelSource: string;
}

/** One MapLibre layer of the area boundaries; only one kind shows at a time. */
export interface BoundaryLayer {
  readonly id: string;
  /** Label layers sit above the basemap labels; fills and lines sit under them. */
  readonly onTop: boolean;
  spec(context: BoundaryContext): LayerSpecification;
}

// Area names show only once areas of that kind are large on screen (MapLibre zooms).
export const LABEL_MIN_ZOOM: Readonly<Record<BoundaryKind, number>> = { ward: 13, assembly: 10, loksabha: 7 };

// Same as --text-secondary and --divider in theme.css; MapLibre paint needs plain values.
export const LINE_COLOR = '#5f6368';
export const OUTDATED_COLOR = '#9aa0a6';
