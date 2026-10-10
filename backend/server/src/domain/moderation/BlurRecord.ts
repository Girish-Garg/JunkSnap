import type { ModerationResult } from "../../contracts/index.gen.js";
import type { BlurPlan } from "./BlurPlanner.js";
import type { FoundSubjects } from "./Subject.js";
import type { FoundRegions } from "./types.js";

export interface BlurFindings {
  readonly faces: FoundRegions;
  readonly plates: FoundRegions;
  readonly subjects: FoundSubjects;
}

export class BlurRecord {
  readonly #findings: BlurFindings;
  readonly #plan: BlurPlan;

  constructor(findings: BlurFindings, plan: BlurPlan) {
    this.#findings = findings;
    this.#plan = plan;
  }

  // DetectFaces reports no model version, so `version` lists only the detectors that do.
  toContract(): NonNullable<ModerationResult["blur"]> {
    const { faces, plates, subjects } = this.#findings;
    const found = [faces, plates, subjects];
    const counts = this.#plan.counts;
    return {
      faces: counts.faces,
      plates: counts.plates,
      provider: "rekognition",
      model: found.map((regions) => regions.model).join("+"),
      version: found.flatMap((regions) => (regions.version === null ? [] : [regions.version])).join("+"),
      regions: { ...counts },
      low_light: this.#plan.lowLight,
    };
  }
}
