import type { GeoPoint } from "../../src/domain/location/GeoPoint.js";
import { Place, type PlaceFields } from "../../src/domain/location/Place.js";
import type { ReverseGeocoder } from "../../src/ports/location/ReverseGeocoder.js";

export class FakeReverseGeocoder implements ReverseGeocoder {
  readonly name = "fake-geocoder";
  readonly calls: GeoPoint[] = [];
  readonly #place: Place;

  constructor(fields: PlaceFields) {
    this.#place = new Place(fields);
  }

  async reverse(point: GeoPoint): Promise<Place> {
    this.calls.push(point);
    return this.#place;
  }
}
