import type { ScanSession } from "../../contracts/index.gen.js";
import type { AutoClaim, AutoClaimKind } from "./AutoClaim.js";
import { ContextAutoClaim } from "./ContextAutoClaim.js";
import { AUTO, DetectableTypes, type ClaimPair } from "./DetectableTypes.js";
import { TypeAutoClaim } from "./TypeAutoClaim.js";

// What each frame report of a scan starts with: a concrete claim, and the part the models will name.
export interface FrameClaim {
  readonly claim: ClaimPair;
  readonly autoClaim?: AutoClaimKind;
}

// Stateless strategies, one per table value of auto_claim.
export const AUTO_CLAIMS: Readonly<Record<AutoClaimKind, AutoClaim>> = { type: new TypeAutoClaim(), context: new ContextAutoClaim() };
// report_upload needs a concrete pair, so a scout frame carries the widest claim until verification names its own.
const SCOUT_PLACEHOLDER = "waste_dump";

export class ScanClaim {
  readonly #session: Pick<ScanSession, "report_type" | "context">;
  readonly #types: DetectableTypes;

  constructor(session: Pick<ScanSession, "report_type" | "context">, types: DetectableTypes = new DetectableTypes()) {
    this.#session = session;
    this.#types = types;
  }

  frame(): FrameClaim {
    const { report_type, context } = this.#session;
    if (report_type === AUTO) {
      return { claim: this.#types.pair(SCOUT_PLACEHOLDER, null), autoClaim: "type" };
    }
    if (context === AUTO) {
      return { claim: this.#types.pair(report_type, null), autoClaim: "context" };
    }
    return { claim: { report_type, context } };
  }
}
