import type { GeoPoint } from "../../domain/location/GeoPoint.js";
import type { AssemblySeat, LokSabhaSeat, SeatMatch } from "../../domain/location/Seats.js";
import type { SeatLocator } from "../../ports/location/SeatLocator.js";

// The seat files leave slivers between seats; a point in one takes the nearest seat this close.
const SEAM_METERS = 1_000;

export class SeatResolver {
  readonly #seats: SeatLocator;

  constructor(seats: SeatLocator) {
    this.#seats = seats;
  }

  get boundariesVersion(): string {
    return this.#seats.boundariesVersion;
  }

  // Null when no Lok Sabha seat contains the point or lies within the seam distance.
  resolve(point: GeoPoint): SeatMatch | null {
    const containingLokSabha = this.#seats.lokSabhaContaining(point);
    const assembly = this.#seats.assemblyContaining(point) ?? this.#nearbyAssembly(point, containingLokSabha);
    const lokSabha =
      this.#lokSabhaOf(assembly) ?? containingLokSabha ?? this.#seats.nearestLokSabha(point, SEAM_METERS);
    return lokSabha === null ? null : { assembly, lokSabha };
  }

  // A point inside another state's Lok Sabha seat never takes a nearby assembly seat across the border.
  #nearbyAssembly(point: GeoPoint, containing: LokSabhaSeat | null): AssemblySeat | null {
    const nearest = this.#seats.nearestAssembly(point, SEAM_METERS);
    const sameSeat = containing === null || containing.id === nearest?.lokSabhaId;
    return sameSeat ? nearest : null;
  }

  // The assembly seat's own Lok Sabha seat, so the MLA and MP always come from the same state.
  #lokSabhaOf(assembly: AssemblySeat | null): LokSabhaSeat | null {
    return assembly === null ? null : this.#seats.lokSabhaSeat(assembly.lokSabhaId);
  }
}
