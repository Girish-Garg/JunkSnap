import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import { NearbySeats, type AssemblyCandidate } from "../../domain/location/NearbySeats.js";
import type { SeatLocator } from "../../ports/location/SeatLocator.js";

// The seat files leave slivers between seats; a point in one takes the nearest seat this close.
export const SEAM_METERS = 1_000;

export class SeatResolver {
  readonly #seats: SeatLocator;

  constructor(seats: SeatLocator) {
    this.#seats = seats;
  }

  get boundariesVersion(): string {
    return this.#seats.boundariesVersion;
  }

  // Null when no Lok Sabha seat contains the point or lies within the seam distance: outside India.
  nearby(point: GeoPoint): NearbySeats | null {
    const [nearest, ...others] = this.#seats.lokSabhaSeatsNear(point, SEAM_METERS);
    if (nearest === undefined) {
      return null;
    }
    const assembly = this.#seats
      .assemblySeatsNear(point, SEAM_METERS)
      .flatMap((seat): AssemblyCandidate[] => {
        const lokSabha = this.#seats.lokSabhaSeat(seat.lokSabhaId);
        return lokSabha === null ? [] : [{ seat, lokSabha }];
      });
    return new NearbySeats(assembly, [nearest, ...others]);
  }
}
