import type { Place } from "./Place.js";
import type { AssemblySeat, LokSabhaSeat, SeatMatch } from "./Seats.js";

export interface AssemblyCandidate {
  readonly seat: AssemblySeat;
  readonly lokSabha: LokSabhaSeat;
}

// Seats near one point, nearest first; a seat that contains the point comes before any seam match.
export class NearbySeats {
  readonly #assembly: readonly AssemblyCandidate[];
  readonly #lokSabha: readonly [LokSabhaSeat, ...LokSabhaSeat[]];

  constructor(assembly: readonly AssemblyCandidate[], lokSabha: readonly [LokSabhaSeat, ...LokSabhaSeat[]]) {
    this.#assembly = assembly;
    this.#lokSabha = lokSabha;
  }

  // Only the geocoder's state counts, so a border point never gets a neighbouring state's MLA or MP.
  forPlace(place: Place): SeatMatch {
    const assembly = this.#assembly.find((candidate) => place.isInState(candidate.lokSabha.state));
    if (assembly !== undefined) {
      return { assembly: assembly.seat, lokSabha: assembly.lokSabha };
    }
    const lokSabha = this.#lokSabha.find((seat) => place.isInState(seat.state));
    // No seat of that state is near: keep the nearest seat, with its MP unknown.
    return { assembly: null, lokSabha: lokSabha ?? { ...this.#lokSabha[0], status: null } };
  }
}
