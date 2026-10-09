import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import type { Place } from "../../domain/location/Place.js";

export interface ReverseGeocoder {
  // Provenance for location_lookup.geocoder, e.g. amazon-location/places-v2.
  readonly name: string;
  reverse(point: GeoPoint): Promise<Place>;
}
