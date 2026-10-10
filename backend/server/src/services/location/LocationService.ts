import type { LocationLookup } from "../../contracts/index.gen.js";
import { ValidationError } from "../../domain/errors.js";
import { GeoPoint } from "../../domain/GeoPoint.js";
import { OutsideIndiaError } from "../../domain/location/OutsideIndiaError.js";
import type { Place } from "../../domain/location/Place.js";
import type { SeatMatch } from "../../domain/location/Seats.js";
import type { ReverseGeocoder } from "../../ports/location/ReverseGeocoder.js";
import type { LocalBodyResolver } from "./LocalBodyResolver.js";
import type { RepresentativeDirectory } from "./RepresentativeDirectory.js";
import type { SeatResolver } from "./SeatResolver.js";

const MAX_LAT = 90;
const MAX_LON = 180;

export interface LocationServiceDeps {
  readonly geocoder: ReverseGeocoder;
  readonly seats: SeatResolver;
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

  // Seats first, so a point outside India never costs a geocoder call; the geocoder's state then picks among them.
  async locate(lat: number, lon: number): Promise<LocationLookup> {
    const point = LocationService.#pointAt(lat, lon);
    const nearby = this.#deps.seats.nearby(point);
    if (nearby === null) {
      throw new OutsideIndiaError("no Lok Sabha seat contains this point or lies within 1 km of it");
    }
    const place = await this.#deps.geocoder.reverse(point);
    if (!place.isInIndia()) {
      throw new OutsideIndiaError(`the geocoder places this point in ${place.countryCode}, not India`);
    }
    return this.#lookup(point, place, nearby.forPlace(place));
  }

  // The negated test also rejects NaN.
  static #pointAt(lat: number, lon: number): GeoPoint {
    if (!(Math.abs(lat) <= MAX_LAT && Math.abs(lon) <= MAX_LON)) {
      throw new ValidationError(`lat ${lat}, lon ${lon} is not a WGS 84 point`);
    }
    return new GeoPoint(lat, lon);
  }

  #lookup(point: GeoPoint, place: Place, seats: SeatMatch): LocationLookup {
    const { geocoder, seats: resolver, localBodies, representatives } = this.#deps;
    const { assembly, lokSabha } = seats;
    return {
      lat: point.lat,
      lon: point.lon,
      state: place.state,
      district: place.districtRef(),
      town: place.town,
      local_body: localBodies.resolve(place),
      // No open map of the 2025 wards yet (data/boundaries/SOURCES.md).
      ward: null,
      assembly_seat: assembly === null ? null : { id: assembly.id, name: assembly.name },
      loksabha_seat: { id: lokSabha.id, name: lokSabha.name, status: lokSabha.status },
      representatives: representatives.forSeats(seats),
      geocoder: geocoder.name,
      boundaries_version: resolver.boundariesVersion,
      looked_up_at: this.#now().toISOString(),
    };
  }
}
