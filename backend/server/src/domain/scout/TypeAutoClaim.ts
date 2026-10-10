import type { VerificationResult } from "../../contracts/index.gen.js";
import { ExternalServiceError } from "../errors.js";
import type { AutoClaim, VerifyClaim } from "./AutoClaim.js";
import { AUTO, DetectableTypes, type ClaimPair } from "./DetectableTypes.js";

// Area scout: the judge names the type and context; not_waste or no_bin means the frame found nothing.
export class TypeAutoClaim implements AutoClaim {
  readonly kind = "type";
  readonly #types: DetectableTypes;

  constructor(types: DetectableTypes = new DetectableTypes()) {
    this.#types = types;
  }

  verifyClaim(): VerifyClaim {
    return { report_type: AUTO, context: AUTO };
  }

  // ml always runs the judge for an auto claim, so a missing verdict is an outage: retry, never reject on it.
  assertAnswered({ judge }: VerificationResult): void {
    if (judge === null) {
      throw new ExternalServiceError("the vision judge did not answer, so the scout frame has no type yet");
    }
  }

  found(_stored: ClaimPair, verification: VerificationResult): ClaimPair | null {
    this.assertAnswered(verification);
    const judge = verification.judge;
    return judge !== null && this.#types.has(judge.report_type) ? this.#types.pair(judge.report_type, judge.context) : null;
  }
}
