import type { Place } from "./Place.js";

export interface LocalBodyRef {
  readonly id: string;
  readonly name: string;
  readonly head_office: string;
}

export interface LocalBodyRecord extends LocalBodyRef {
  readonly state: string;
  readonly towns: readonly string[];
}

// An urban local body responsible for waste in its towns; its head is a letter's To.
export class LocalBody {
  readonly #record: LocalBodyRecord;

  constructor(record: LocalBodyRecord) {
    this.#record = record;
  }

  serves(place: Place): boolean {
    return place.isIn(this.#record.state, this.#record.towns);
  }

  toRef(): LocalBodyRef {
    const { id, name, head_office } = this.#record;
    return { id, name, head_office };
  }
}
