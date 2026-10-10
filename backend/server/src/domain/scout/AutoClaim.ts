import type { VerificationResult } from "../../contracts/index.gen.js";
import type { ClaimedContext, ClaimedType, ClaimPair } from "./DetectableTypes.js";

// Table-only reports attribute auto_claim (contracts v1.10): which part of a scan frame's claim the models name.
export type AutoClaimKind = "type" | "context";

// What the worker asks ml to check; auto stands for the part the models must name.
export interface VerifyClaim {
  readonly report_type: ClaimedType | "auto";
  readonly context: ClaimedContext | "auto";
}

// A scan frame whose type or place comes from the models instead of the person recording.
export interface AutoClaim {
  readonly kind: AutoClaimKind;
  verifyClaim(stored: ClaimPair): VerifyClaim;
  // Throws when the answer cannot settle this claim (a judge outage), whatever the decision, so SQS retries.
  assertAnswered(verification: VerificationResult): void;
  // The claim the report takes on once the models passed it, or null when they found nothing it can become.
  found(stored: ClaimPair, verification: VerificationResult): ClaimPair | null;
}
