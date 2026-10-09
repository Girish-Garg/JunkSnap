import type { PhotoKind } from "../../domain/moderation/PhotoId.js";
import type { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";
import type { DeviceRegistry } from "../../ports/moderation/DeviceRegistry.js";
import type { Geofence } from "../../ports/moderation/Geofence.js";
import type { HashIndex } from "../../ports/moderation/HashIndex.js";
import type { Check } from "./checks/Check.js";
import { DeviceTokenCheck } from "./checks/DeviceTokenCheck.js";
import { DuplicateCheck } from "./checks/DuplicateCheck.js";
import { FreshTimestampCheck } from "./checks/FreshTimestampCheck.js";
import { InsideIndiaCheck } from "./checks/InsideIndiaCheck.js";
import { NearSiteCheck } from "./checks/NearSiteCheck.js";
import { RateLimitCheck } from "./checks/RateLimitCheck.js";

export interface CheckPorts {
  readonly india: Geofence;
  readonly hashes: HashIndex;
  readonly devices: DeviceRegistry;
}

// Builds each chain once, in contract order; cleanup after-photos add near_site.
export class CheckFactory {
  readonly #chains: Readonly<Record<PhotoKind, readonly Check[]>>;

  constructor(ports: CheckPorts) {
    const report = [
      new InsideIndiaCheck(ports.india),
      new FreshTimestampCheck(),
      new DuplicateCheck(ports.hashes),
      new RateLimitCheck(ports.devices),
      new DeviceTokenCheck(ports.devices),
    ];
    this.#chains = { report, cleanup: [...report, new NearSiteCheck()] };
  }

  checksFor(submission: PhotoSubmission): readonly Check[] {
    return this.#chains[submission.photoId.kind];
  }
}
