import type { CcLine, SeatRef } from "./types.js";

type Office = CcLine["office"];

export interface LocalBody {
  readonly id: string;
  readonly name: string;
  readonly headOffice: string;
}

export interface Representative {
  readonly office: Office;
  readonly seatId: string;
}

export interface PlaceProps {
  readonly state: string;
  readonly district: SeatRef;
  readonly town: string | null;
  readonly localBody: LocalBody | null;
  readonly ward: SeatRef | null;
  readonly assemblySeat: SeatRef | null;
  // Null when the site has no current Lok Sabha seat (outdated delimitation), so no MP is copied.
  readonly loksabhaSeat: SeatRef | null;
  readonly representatives: readonly Representative[];
}

export class SitePlace {
  readonly state: string;
  readonly district: SeatRef;
  readonly town: string | null;
  readonly localBody: LocalBody | null;
  readonly ward: SeatRef | null;
  readonly #seats: readonly (readonly [Office, SeatRef | null])[];
  readonly #representatives: readonly Representative[];

  constructor(props: PlaceProps) {
    this.state = props.state;
    this.district = props.district;
    this.town = props.town;
    this.localBody = props.localBody;
    this.ward = props.ward;
    this.#seats = [
      ["councillor", props.ward],
      ["mla", props.assemblySeat],
      ["mp", props.loksabhaSeat],
    ];
    this.#representatives = props.representatives;
  }

  ccLines(): CcLine[] {
    return this.#seats.flatMap(([office, seat]) =>
      seat !== null && this.#represented(office, seat.id)
        ? [{ office, seat: { id: seat.id, name: seat.name }, marking: "for attention" as const }]
        : [],
    );
  }

  name(): string {
    const town = this.town ?? this.district.name;
    return this.ward === null ? town : `${this.ward.name}, ${town}`;
  }

  placeholders(): ReadonlyMap<string, string> {
    const values = new Map([
      ["{state}", this.state],
      ["{district.name}", this.district.name],
    ]);
    if (this.localBody !== null) {
      values.set("{local_body.name}", this.localBody.name);
      values.set("{local_body.head_office}", this.localBody.headOffice);
    }
    return values;
  }

  #represented(office: Office, seatId: string): boolean {
    return this.#representatives.some((row) => row.office === office && row.seatId === seatId);
  }
}
