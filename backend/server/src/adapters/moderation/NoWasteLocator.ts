import type { LabeledBox } from "../../domain/moderation/GatePolicy.js";
import type { WasteLocator } from "../../ports/moderation/WasteLocator.js";

// Known gap until the trained detector's waste boxes land (issue 50): Rekognition returns Garbage and Trash without boxes.
export class NoWasteLocator implements WasteLocator {
  async locate(): Promise<LabeledBox[]> {
    return [];
  }
}
