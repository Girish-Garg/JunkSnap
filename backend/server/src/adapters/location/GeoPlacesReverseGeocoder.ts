import {
  ReverseGeocodeCommand,
  type Address,
  type GeoPlacesClient,
  type ReverseGeocodeCommandOutput,
} from "@aws-sdk/client-geo-places";
import { ExternalServiceError } from "../../domain/errors.js";
import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import { Place } from "../../domain/location/Place.js";
import type { ReverseGeocoder } from "../../ports/location/ReverseGeocoder.js";

export type GeoPlacesSender = Pick<GeoPlacesClient, "send">;

// Places v2 needs no place index; IntendedUse Storage is required because sites keep the result.
export class GeoPlacesReverseGeocoder implements ReverseGeocoder {
  readonly name = "amazon-location/places-v2";
  readonly #client: GeoPlacesSender;

  constructor(client: GeoPlacesSender) {
    this.#client = client;
  }

  async reverse(point: GeoPoint): Promise<Place> {
    const output = await this.#send(point);
    const address = output.ResultItems?.[0]?.Address;
    if (address === undefined) {
      throw new ExternalServiceError("Amazon Location found no address at this point");
    }
    return GeoPlacesReverseGeocoder.#toPlace(address);
  }

  async #send(point: GeoPoint): Promise<ReverseGeocodeCommandOutput> {
    const command = new ReverseGeocodeCommand({
      QueryPosition: point.toPosition(),
      MaxResults: 1,
      Language: "en",
      IntendedUse: "Storage",
    });
    try {
      return await this.#client.send(command);
    } catch (error) {
      throw new ExternalServiceError("Amazon Location reverse geocode failed", { cause: error });
    }
  }

  // Region is the state and SubRegion the district; Address.District is only a neighbourhood.
  static #toPlace(address: Address): Place {
    const countryCode = address.Country?.Code2;
    const state = address.Region?.Name;
    const district = address.SubRegion?.Name;
    if (countryCode === undefined || state === undefined || district === undefined) {
      throw new ExternalServiceError("Amazon Location returned no country, region or subregion");
    }
    return new Place({ countryCode, state, district, town: address.Locality ?? null });
  }
}
