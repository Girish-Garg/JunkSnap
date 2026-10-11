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
  readonly reportHashes: HashIndex;
  // Earlier after-photos of the same site only: a cleared site can look like its before-photo.
  readonly cleanupHashes: HashIndex;
  readonly devices: DeviceRegistry;
  // SNAP_PER_HOUR.
  readonly snapPerHour: number;
}

// Builds each chain once, in contract order; cleanup after-photos add near_site.
export class CheckFactory {
  readonly #chains: Readonly<Record<PhotoKind, readonly Check[]>>;

  constructor(ports: CheckPorts) {
    this.#chains = {
      report: this.#chain(ports, new DuplicateCheck(ports.reportHashes, "earlier photo")),
      cleanup: [
        ...this.#chain(ports, new DuplicateCheck(ports.cleanupHashes, "earlier after-photo of this site")),
        new NearSiteCheck(),
      ],
    };
  }

  checksFor(submission: PhotoSubmission): readonly Check[] {
    return this.#chains[submission.photoId.kind];
  }

  #chain(ports: CheckPorts, duplicate: DuplicateCheck): Check[] {
    return [
      new InsideIndiaCheck(ports.india),
      new FreshTimestampCheck(),
      duplicate,
      new RateLimitCheck(ports.devices, ports.snapPerHour),
      new DeviceTokenCheck(ports.devices),
    ];
  }
}
