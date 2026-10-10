import type { Sender } from "../../domain/moderation/PhotoSubmission.js";

export interface DeviceStanding {
  readonly known: boolean;
  readonly reputation: number;
  readonly blocked: boolean;
}

export interface PhotoWindow {
  readonly sender: Sender;
  readonly from: Date;
  readonly to: Date;
}

// Devices and signed-in accounts: the devices and users tables, and reports by-device and by-user.
export interface DeviceRegistry {
  // An unknown sender is not an error: it comes back with known false and the starting reputation.
  standing(sender: Sender): Promise<DeviceStanding>;
  // Snap photos the sender sent with received_at in [from, to], the current photo included; scan frames never count.
  snapPhotos(window: PhotoWindow): Promise<number>;
}
