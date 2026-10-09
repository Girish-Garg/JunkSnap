import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import type { CaptureMode } from "../../../domain/moderation/PhotoSubmission.js";
import type { DeviceRegistry } from "../../../ports/moderation/DeviceRegistry.js";
import type { Check, CheckSubject } from "./Check.js";

interface RateWindow {
  readonly limit: number;
  readonly seconds: number;
  readonly one: string;
  readonly many: string;
  readonly span: string;
}

// contracts/README.md: Snap 20 photos per hour, Scan 1 frame per second, per device.
const WINDOWS: Readonly<Record<CaptureMode, RateWindow>> = {
  snap: { limit: 20, seconds: 3600, one: "photo", many: "photos", span: "hour" },
  scan: { limit: 1, seconds: 1, one: "frame", many: "frames", span: "second" },
};

export class RateLimitCheck implements Check {
  readonly key = "rate_limit";
  readonly reason = "rate_limited";
  readonly #devices: DeviceRegistry;

  constructor(devices: DeviceRegistry) {
    this.#devices = devices;
  }

  async run({ submission }: CheckSubject): Promise<CheckOutcome> {
    const { deviceToken, captureMode, receivedAt } = submission.fields;
    const window = WINDOWS[captureMode];
    const from = new Date(receivedAt.getTime() - window.seconds * 1000);
    const count = await this.#devices.photosReceived({ deviceToken, mode: captureMode, from, to: receivedAt });
    const unit = count === 1 ? window.one : window.many;
    const detail = `${count} ${unit} in the last ${window.span}; limit ${window.limit}`;
    return count > window.limit ? CheckOutcome.fail(detail) : CheckOutcome.pass(detail);
  }
}
