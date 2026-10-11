import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import type { ModerationRules } from "../../../domain/moderation/ModerationRules.js";
import type { HashIndex } from "../../../ports/moderation/HashIndex.js";
import type { Check, CheckSubject } from "./Check.js";

type DuplicateRules = Pick<ModerationRules, "duplicateRadiusM" | "duplicateMaxBits">;

export class DuplicateCheck implements Check {
  readonly key = "duplicate";
  readonly reason = "duplicate";
  readonly #index: HashIndex;
  // What the photo is compared with, for the detail: "earlier photo" or "earlier after-photo of this site".
  readonly #earlier: string;
  readonly #rules: DuplicateRules;

  // rules: DUPLICATE_RADIUS_M and DUPLICATE_MAX_BITS.
  constructor(index: HashIndex, earlier: string, rules: DuplicateRules) {
    this.#index = index;
    this.#earlier = earlier;
    this.#rules = rules;
  }

  async run({ submission, hash }: CheckSubject): Promise<CheckOutcome> {
    const { photoId, location } = submission.fields;
    const { duplicateRadiusM: radiusM, duplicateMaxBits: maxBits } = this.#rules;
    const nearby = await this.#index.earlierPhotos(submission, radiusM);
    const earlier = nearby
      .filter((photo) => photo.photoId !== photoId.value && photo.location.distanceTo(location) <= radiusM)
      .map((photo) => ({ photoId: photo.photoId, distance: hash.distanceTo(photo.hash) }))
      .sort((a, b) => a.distance - b.distance);
    const closest = earlier[0];
    if (closest === undefined) {
      return CheckOutcome.pass(`no ${this.#earlier} within ${radiusM} m`);
    }
    if (closest.distance <= maxBits) {
      const detail = `pHash distance ${closest.distance} to an ${this.#earlier} within ${radiusM} m; limit ${maxBits}`;
      return CheckOutcome.fail(detail, closest.photoId);
    }
    return CheckOutcome.pass(`nearest ${this.#earlier} at pHash distance ${closest.distance}; limit ${maxBits}`);
  }
}
