import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { MapMode } from '../domain/MapMode';

/** What a layer needs to describe itself; SiteMap re-adds layers when this changes. */
export interface LayerContext {
  readonly sourceId: string;
  readonly mode: MapMode;
  readonly selectedId: string | null;
}

export interface MapLayer {
  readonly id: string;
  /** Lower draws first. */
  readonly order: number;
  /** Tapping it picks a site. */
  readonly interactive: boolean;
  /** Loads images the layer needs before it is added. */
  prepare?(map: MapLibreMap): Promise<void>;
  spec(context: LayerContext): LayerSpecification;
}
