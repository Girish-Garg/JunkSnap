import type { LabeledBox } from "../../domain/moderation/GatePolicy.js";

// Boxes around waste, for the person_dumping overlap; empty when the source cannot place waste.
export interface WasteLocator {
  locate(jpeg: Uint8Array): Promise<LabeledBox[]>;
}
