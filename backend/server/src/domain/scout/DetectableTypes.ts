import type { ReportUpload } from "../../contracts/index.gen.js";
import { InternalDataError } from "../errors.js";

export type ClaimedType = ReportUpload["report_type"];
export type ClaimedContext = ReportUpload["context"];
export const AUTO = "auto";

export interface ClaimPair {
  readonly report_type: ClaimedType;
  readonly context: ClaimedContext;
}

export interface TypeContexts {
  readonly contexts: readonly ClaimedContext[];
  // The context a frame gets when the models name none that fits its type.
  readonly fallback: ClaimedContext;
}

// no_bin is absent: only a person standing there can assert that there is no bin.
const DETECTABLE: ReadonlyMap<string, TypeContexts> = new Map<string, TypeContexts>([
  ["waste_dump", { contexts: ["vacant_plot", "roadside", "drain", "other"], fallback: "other" }],
  ["overflowing_bin", { contexts: ["overflowing", "damaged"], fallback: "overflowing" }],
  ["contaminated_water", { contexts: ["stagnant", "sewage", "foam", "choked_drain"], fallback: "stagnant" }],
  ["open_construction", { contexts: ["uncovered_debris", "dusty_site"], fallback: "uncovered_debris" }],
]);

// The report types a scout scan finds in a frame by itself, and their contexts.
export class DetectableTypes {
  readonly #known: ReadonlyMap<string, TypeContexts>;

  constructor(known: ReadonlyMap<string, TypeContexts> = DETECTABLE) {
    this.#known = known;
  }

  has(type: string): type is ClaimedType {
    return this.#known.has(type);
  }

  // The named context when it belongs to the type, else the type's fallback.
  pair(type: ClaimedType, context: string | null | undefined): ClaimPair {
    const known = this.#known.get(type);
    if (known === undefined) {
      throw new InternalDataError(`the models never name ${type} by themselves`);
    }
    return { report_type: type, context: known.contexts.find((candidate) => candidate === context) ?? known.fallback };
  }
}
