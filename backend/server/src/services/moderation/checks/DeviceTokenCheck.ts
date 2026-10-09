import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import type { DeviceRegistry } from "../../../ports/moderation/DeviceRegistry.js";
import type { Check, CheckSubject } from "./Check.js";

export class DeviceTokenCheck implements Check {
  readonly key = "device_token";
  readonly reason = "blocked_device";
  readonly #devices: DeviceRegistry;

  constructor(devices: DeviceRegistry) {
    this.#devices = devices;
  }

  async run({ submission }: CheckSubject): Promise<CheckOutcome> {
    const standing = await this.#devices.standing(submission.fields.deviceToken);
    if (standing.blocked) {
      return CheckOutcome.fail("device blocked");
    }
    const age = standing.known ? "known" : "new";
    return CheckOutcome.pass(`${age} device, reputation ${Number(standing.reputation.toFixed(2))}`);
  }
}
