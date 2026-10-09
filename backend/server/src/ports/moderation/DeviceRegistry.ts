import type { CaptureMode } from "../../domain/moderation/PhotoSubmission.js";

export interface DeviceStanding {
  readonly known: boolean;
  readonly reputation: number;
  readonly blocked: boolean;
}

export interface PhotoWindow {
  readonly deviceToken: string;
  readonly mode: CaptureMode;
  readonly from: Date;
  readonly to: Date;
}

export interface DeviceRegistry {
  // An unknown device is not an error: it comes back with known false and the starting reputation.
  standing(deviceToken: string): Promise<DeviceStanding>;
  // Photos of this mode the device sent with received_at in [from, to], the current photo included.
  photosReceived(window: PhotoWindow): Promise<number>;
}
