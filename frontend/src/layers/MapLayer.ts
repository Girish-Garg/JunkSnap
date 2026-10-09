import type { FilterSpecification, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';

export const CLUSTERS: FilterSpecification = ['has', 'point_count'];
export const SINGLE_SITES: FilterSpecification = ['!', ['has', 'point_count']];

export interface MapLayer {
  readonly id: string;
  /** Lower draws first. */
  readonly order: number;
  /** Tapping it selects a site or opens a cluster. */
  readonly interactive: boolean;
  /** Loads images the layer needs before it is added. */
  prepare?(map: MapLibreMap): Promise<void>;
  spec(sourceId: string): LayerSpecification;
}
