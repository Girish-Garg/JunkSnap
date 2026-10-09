import type { LocalBody, LocalBodyRef } from "../../domain/location/LocalBody.js";
import type { Place } from "../../domain/location/Place.js";

export class LocalBodyResolver {
  readonly #bodies: readonly LocalBody[];

  constructor(bodies: readonly LocalBody[]) {
    this.#bodies = bodies;
  }

  resolve(place: Place): LocalBodyRef | null {
    return this.#bodies.find((body) => body.serves(place))?.toRef() ?? null;
  }
}
