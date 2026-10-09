import type { DeviceRegistry, DeviceStanding } from "../../src/ports/moderation/DeviceRegistry.js";

// Every sender is new; counts the photos sent so far in this run.
export class MemoryDeviceRegistry implements DeviceRegistry {
  #sent = 0;

  record(): void {
    this.#sent += 1;
  }

  async standing(): Promise<DeviceStanding> {
    return { known: false, reputation: 0.5, blocked: false };
  }

  async snapPhotos(): Promise<number> {
    return this.#sent;
  }
}
