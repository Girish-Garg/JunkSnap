import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import type { HashIndex } from "../../../ports/moderation/HashIndex.js";
import type { Check, CheckSubject } from "./Check.js";

const RADIUS_M = 100;
const MAX_DISTANCE = 8;

export class DuplicateCheck implements Check {
  readonly key = "duplicate";
  readonly reason = "duplicate";
  readonly #index: HashIndex;

  constructor(index: HashIndex) {
    this.#index = index;
  }

  async run({ submission, hash }: CheckSubject): Promise<CheckOutcome> {
    const { photoId, location } = submission.fields;
    const nearby = await this.#index.near(location, RADIUS_M);
    const earlier = nearby
      .filter((photo) => photo.photoId !== photoId.value && photo.location.distanceTo(location) <= RADIUS_M)
      .map((photo) => ({ photoId: photo.photoId, distance: hash.distanceTo(photo.hash) }))
      .sort((a, b) => a.distance - b.distance);
    const closest = earlier[0];
    if (closest === undefined) {
      return CheckOutcome.pass(`no earlier photo within ${RADIUS_M} m`);
    }
    if (closest.distance <= MAX_DISTANCE) {
      const detail = `pHash distance ${closest.distance} to an earlier photo within ${RADIUS_M} m; limit ${MAX_DISTANCE}`;
      return CheckOutcome.fail(detail, closest.photoId);
    }
    return CheckOutcome.pass(`nearest earlier photo at pHash distance ${closest.distance}; limit ${MAX_DISTANCE}`);
  }
}
