import type { ModerationResult } from "../../contracts/index.gen.js";
import type { FoundRegions } from "./types.js";

export class BlurRecord {
  readonly #faces: FoundRegions;
  readonly #plates: FoundRegions;

  constructor(faces: FoundRegions, plates: FoundRegions) {
    this.#faces = faces;
    this.#plates = plates;
  }

  // DetectFaces reports no model version, so `version` lists only the detectors that do.
  toContract(): NonNullable<ModerationResult["blur"]> {
    const found = [this.#faces, this.#plates];
    return {
      faces: this.#faces.boxes.length,
      plates: this.#plates.boxes.length,
      provider: "rekognition",
      model: found.map((regions) => regions.model).join("+"),
      version: found.flatMap((regions) => (regions.version === null ? [] : [regions.version])).join("+"),
    };
  }
}
