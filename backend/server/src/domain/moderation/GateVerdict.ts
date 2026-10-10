import type { ModerationResult } from "../../contracts/index.gen.js";
import type { ModelStamp, RejectReason } from "./types.js";

type GateReason = Extract<RejectReason, "invalid_image" | "unsafe_image" | "person_dumping">;

const IMAGE_VALIDATOR: ModelStamp = { provider: "junksnap", model: "ImageValidator", version: "1" };

// Result of the image gate; `labels` names what was flagged and is empty on a pass.
export class GateVerdict {
  readonly reason: GateReason | null;
  readonly labels: readonly string[];
  readonly stamp: ModelStamp;

  private constructor(reason: GateReason | null, labels: readonly string[], stamp: ModelStamp) {
    this.reason = reason;
    this.labels = labels;
    this.stamp = stamp;
  }

  static pass(stamp: ModelStamp): GateVerdict {
    return new GateVerdict(null, [], stamp);
  }

  static fail(reason: Exclude<GateReason, "invalid_image">, labels: readonly string[], stamp: ModelStamp): GateVerdict {
    return new GateVerdict(reason, labels, stamp);
  }

  // The image never reached Rekognition; `cause` says why, for example too_large.
  static invalidImage(cause: string): GateVerdict {
    return new GateVerdict("invalid_image", [cause], IMAGE_VALIDATOR);
  }

  get failed(): boolean {
    return this.reason !== null;
  }

  toContract(): ModerationResult["image_moderation"] {
    return { result: this.failed ? "fail" : "pass", labels: [...this.labels], ...this.stamp };
  }
}
