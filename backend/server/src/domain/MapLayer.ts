import type { NearPlace } from "./sites/SiteTypes.js";

export type PlaceKind = NearPlace["kind"];

// One OpenStreetMap feature: a place has one [lat, lon] pair, a line or area its vertices.
export interface MapFeature {
  readonly ref: string;
  readonly coords: readonly (readonly [number, number])[];
}

// One crawled layer from data/wards/<city>.json map_layers, with its provenance.
export interface MapLayer {
  readonly kind: PlaceKind;
  readonly source: NearPlace["source"];
  readonly features: readonly MapFeature[];
}
