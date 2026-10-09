import type { AreaRef } from "./Seats.js";

const INDIA = "IN";
const MAX_AREA_ID = 64;

export interface PlaceFields {
  readonly countryCode: string;
  readonly state: string;
  readonly district: string;
  readonly town: string | null;
}

export class Place {
  readonly countryCode: string;
  readonly state: string;
  readonly district: string;
  readonly town: string | null;

  constructor(fields: PlaceFields) {
    this.countryCode = fields.countryCode;
    this.state = fields.state;
    this.district = fields.district;
    this.town = fields.town;
  }

  isInIndia(): boolean {
    return this.countryCode === INDIA;
  }

  // Amazon writes "Jammu & Kashmir" where the seat files write "Jammu and Kashmir".
  isInState(state: string): boolean {
    return Place.#key(this.state) === Place.#key(state);
  }

  isIn(state: string, towns: readonly string[]): boolean {
    const town = this.town?.toLowerCase();
    return this.isInState(state) && towns.some((name) => name.toLowerCase() === town);
  }

  // Area ids allow [a-z0-9-] only, so Rajasthan and Jodhpur become rajasthan-jodhpur.
  districtRef(): AreaRef {
    const id = `${this.state} ${this.district}`
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, MAX_AREA_ID)
      .replace(/^-+|-+$/g, "");
    return { id, name: this.district };
  }

  static #key(state: string): string {
    return state.toLowerCase().replaceAll("&", " and ").replace(/[^a-z0-9]/g, "");
  }
}
