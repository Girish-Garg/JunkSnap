import type { Office, Representative, SeatMatch } from "../../domain/location/Seats.js";

// Offices and seats only (decision 0137): a row never carries a name or a party.
export class RepresentativeDirectory {
  readonly #rows: ReadonlyMap<string, Representative>;

  constructor(rows: readonly Representative[]) {
    this.#rows = new Map(rows.map((row) => [RepresentativeDirectory.#key(row.office, row.seat_id), row]));
  }

  // No MLA row without an assembly seat; no MP row for a seat whose shape is outdated.
  forSeats(seats: SeatMatch): Representative[] {
    const mla = seats.assembly === null ? undefined : this.#row("mla", seats.assembly.id);
    const mp = seats.lokSabha.status === "current" ? this.#row("mp", seats.lokSabha.id) : undefined;
    return [mla, mp].filter((row) => row !== undefined);
  }

  #row(office: Office, seatId: string): Representative | undefined {
    return this.#rows.get(RepresentativeDirectory.#key(office, seatId));
  }

  static #key(office: Office, seatId: string): string {
    return `${office}/${seatId}`;
  }
}
