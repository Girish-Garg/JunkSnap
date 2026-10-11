import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { MapMode } from '../domain/MapMode';

/** What a layer needs to describe itself; SiteMap re-adds layers when this changes. */
export interface LayerContext {
  /** Every site, one feature each: heat, zones and the selected pin. */
  readonly sourceId: string;
  /** One feature per pin: lone sites, and stacks of sites at one spot (PinFeatures.pins). */
  readonly pinSourceId: string;
  readonly mode: MapMode;
  readonly selectedId: string | null;
}

/** What layers draw at a fixed size on the ground: a no-bin zone's radius, near the pilot city's latitude. */
export interface LayerSettings {
  readonly zoneRadiusM: number;
  /** Degrees north where metres turn into pixels for the zone circles. */
  readonly latitude: number;
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
