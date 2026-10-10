import { CheckOutcome } from "../../../domain/moderation/CheckOutcome.js";
import type { DeviceRegistry } from "../../../ports/moderation/DeviceRegistry.js";
import type { Check, CheckSubject } from "./Check.js";

const BLOCKED_DETAIL = { device: "device blocked", user: "account blocked" } as const;

// Checks the device and, when signed in, the account; the lower reputation is the one reported.
export class DeviceTokenCheck implements Check {
  readonly key = "device_token";
  readonly reason = "blocked_device";
  readonly #devices: DeviceRegistry;

  constructor(devices: DeviceRegistry) {
    this.#devices = devices;
  }

  async run({ submission }: CheckSubject): Promise<CheckOutcome> {
    const senders = submission.senders();
    const standings = await Promise.all(senders.map((sender) => this.#devices.standing(sender)));
    const blocked = senders.find((_sender, index) => standings[index]?.blocked === true);
    if (blocked !== undefined) {
      return CheckOutcome.fail(BLOCKED_DETAIL[blocked.kind]);
    }
    const age = standings[0]?.known === true ? "known" : "new";
    const reputation = Math.min(...standings.map((standing) => standing.reputation));
    return CheckOutcome.pass(`${age} device, reputation ${Number(reputation.toFixed(2))}`);
  }
}
