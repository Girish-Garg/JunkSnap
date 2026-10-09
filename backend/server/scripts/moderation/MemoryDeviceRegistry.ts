import type { DeviceRegistry, DeviceStanding } from "../../src/ports/moderation/DeviceRegistry.js";

// Every device is new; counts the photos sent so far in this run.
export class MemoryDeviceRegistry implements DeviceRegistry {
  #sent = 0;

  record(): void {
    this.#sent += 1;
  }

  async standing(): Promise<DeviceStanding> {
    return { known: false, reputation: 0.5, blocked: false };
  }

  async photosReceived(): Promise<number> {
    return this.#sent;
  }
}
