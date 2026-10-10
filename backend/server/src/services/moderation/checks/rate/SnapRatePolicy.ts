import { CheckOutcome } from "../../../../domain/moderation/CheckOutcome.js";
import type { PhotoSubmission } from "../../../../domain/moderation/PhotoSubmission.js";
import type { DeviceRegistry } from "../../../../ports/moderation/DeviceRegistry.js";
import type { RatePolicy } from "./RatePolicy.js";

const LIMIT = 20;
const WINDOW_MS = 3600 * 1000;

// Counted per device and per account; the higher count, so the stricter limit, applies.
export class SnapRatePolicy implements RatePolicy {
  readonly #devices: DeviceRegistry;

  constructor(devices: DeviceRegistry) {
    this.#devices = devices;
  }

  async assess(submission: PhotoSubmission): Promise<CheckOutcome> {
    const to = submission.fields.receivedAt;
    const from = new Date(to.getTime() - WINDOW_MS);
    const counts = await Promise.all(
      submission.senders().map((sender) => this.#devices.snapPhotos({ sender, from, to })),
    );
    const count = Math.max(...counts);
    const detail = `${count} ${count === 1 ? "photo" : "photos"} in the last hour; limit ${LIMIT}`;
    return count > LIMIT ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
  }
}
