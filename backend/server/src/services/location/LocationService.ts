import type { LocationLookup } from "../../contracts/index.gen.js";
import { GeoPoint } from "../../domain/location/GeoPoint.js";
import { OutsideIndiaError } from "../../domain/location/OutsideIndiaError.js";
import type { Place } from "../../domain/location/Place.js";
import type { AreaRef, SeatMatch } from "../../domain/location/Seats.js";
import type { ReverseGeocoder } from "../../ports/location/ReverseGeocoder.js";
import type { SeatLocator } from "../../ports/location/SeatLocator.js";
import type { LocalBodyResolver } from "./LocalBodyResolver.js";
import type { RepresentativeDirectory } from "./RepresentativeDirectory.js";

// Until the contracts update lands, location_lookup still requires an assembly seat everywhere.
export type LocatedPoint = Omit<LocationLookup, "assembly_seat"> & { assembly_seat: AreaRef | null };

export interface LocationServiceDeps {
  readonly geocoder: ReverseGeocoder;
  readonly seats: SeatLocator;
  readonly localBodies: LocalBodyResolver;
  readonly representatives: RepresentativeDirectory;
  readonly now?: () => Date;
}

export class LocationService {
  readonly #deps: LocationServiceDeps;
  readonly #now: () => Date;

  constructor(deps: LocationServiceDeps) {
    this.#deps = deps;
    this.#now = deps.now ?? (() => new Date());
  }

  // Seats first, so a point outside India never costs a geocoder call.
  async locate(lat: number, lon: number): Promise<LocatedPoint> {
    const point = GeoPoint.of(lat, lon);
    const seats = this.#seatsAt(point);
    const place = await this.#deps.geocoder.reverse(point);
    if (!place.isInIndia()) {
      throw new OutsideIndiaError(`the geocoder places this point in ${place.countryCode}, not India`);
    }
    return this.#lookup(point, place, seats);
  }

  #seatsAt(point: GeoPoint): SeatMatch {
    const lokSabha = this.#deps.seats.lokSabhaSeatAt(point);
    if (lokSabha === null) {
      throw new OutsideIndiaError("no Lok Sabha seat contains this point");
    }
    return { assembly: this.#deps.seats.assemblySeatAt(point), lokSabha };
  }

  #lookup(point: GeoPoint, place: Place, seats: SeatMatch): LocatedPoint {
    const { geocoder, seats: locator, localBodies, representatives } = this.#deps;
    return {
      lat: point.lat,
      lon: point.lon,
      state: place.state,
      district: place.districtRef(),
      town: place.town,
      local_body: localBodies.resolve(place),
      // No open map of the 2025 wards yet (data/boundaries/SOURCES.md).
      ward: null,
      assembly_seat: seats.assembly === null ? null : { id: seats.assembly.id, name: seats.assembly.name },
      loksabha_seat: { id: seats.lokSabha.id, name: seats.lokSabha.name },
      representatives: representatives.forSeats(seats),
      geocoder: geocoder.name,
      boundaries_version: locator.boundariesVersion,
      looked_up_at: this.#now().toISOString(),
    };
  }
}
