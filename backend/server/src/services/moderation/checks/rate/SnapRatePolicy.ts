import { CheckOutcome } from "../../../../domain/moderation/CheckOutcome.js";
import type { PhotoSubmission } from "../../../../domain/moderation/PhotoSubmission.js";
import type { DeviceRegistry } from "../../../../ports/moderation/DeviceRegistry.js";
import type { RatePolicy } from "./RatePolicy.js";

const WINDOW_MS = 3600 * 1000;

// Counted per device and per account; the higher count, so the stricter limit, applies.
export class SnapRatePolicy implements RatePolicy {
  readonly #devices: DeviceRegistry;
  readonly #limit: number;

  // limit: SNAP_PER_HOUR.
  constructor(devices: DeviceRegistry, limit: number) {
    this.#devices = devices;
    this.#limit = limit;
  }

  async assess(submission: PhotoSubmission): Promise<CheckOutcome> {
    const to = submission.fields.receivedAt;
    const from = new Date(to.getTime() - WINDOW_MS);
    const counts = await Promise.all(
      submission.senders().map((sender) => this.#devices.snapPhotos({ sender, from, to })),
    );
    const count = Math.max(...counts);
    const detail = `${count} ${count === 1 ? "photo" : "photos"} in the last hour; limit ${this.#limit}`;
    return count > this.#limit ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
  }
}
