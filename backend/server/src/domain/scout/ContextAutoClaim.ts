import type { VerificationResult } from "../../contracts/index.gen.js";
import type { AutoClaim, VerifyClaim } from "./AutoClaim.js";
import { AUTO, DetectableTypes, type ClaimPair } from "./DetectableTypes.js";

// The person picked the type; the judge names the place, else the type's fallback context stands.
export class ContextAutoClaim implements AutoClaim {
  readonly kind = "context";
  readonly #types: DetectableTypes;

  constructor(types: DetectableTypes = new DetectableTypes()) {
    this.#types = types;
  }

  verifyClaim(stored: ClaimPair): VerifyClaim {
    return { report_type: stored.report_type, context: AUTO };
  }

  found(stored: ClaimPair, { judge }: VerificationResult): ClaimPair {
    const named = judge?.report_type === stored.report_type ? judge.context : null;
    return this.#types.pair(stored.report_type, named);
  }
}
