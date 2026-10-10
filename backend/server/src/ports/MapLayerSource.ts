import type { MapLayer } from "../domain/MapLayer.js";

// The sensitive-place layers (school, hospital, water, drain) of every crawled city.
export interface MapLayerSource {
  layers(): Promise<readonly MapLayer[]>;
}
