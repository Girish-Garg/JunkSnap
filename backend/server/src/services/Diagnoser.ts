import type { WardScores } from "../contracts/index.gen.js";

export type Diagnosis = WardScores["diagnosis"][number];

const POOR = 50;
const SLOW_DAYS = 7;
const REPEAT_PCT = 20;

export interface DiagnosisInput {
  // The citizen score before the bin access adjustment, so the adjustment never hides dumping.
  readonly citizenRaw: number | null;
  readonly binAccess: number | null;
  readonly medianDaysToClear: number | null;
  readonly clearedWithin7DaysPct: number | null;
  readonly redumpedPct: number | null;
}

// A missing input never triggers a diagnosis.
export class Diagnoser {
  diagnose(input: DiagnosisInput): Diagnosis[] {
    return [...this.#dumping(input), ...this.#clearing(input)];
  }

  #dumping({ citizenRaw, binAccess }: DiagnosisInput): Diagnosis[] {
    if (!Diagnoser.#below(citizenRaw, POOR) || binAccess === null) {
      return [];
    }
    return [binAccess < POOR ? "infrastructure_gap" : "behaviour"];
  }

  #clearing(input: DiagnosisInput): Diagnosis[] {
    const found: Diagnosis[] = [];
    const slow = (input.medianDaysToClear ?? 0) > SLOW_DAYS;
    if (slow || Diagnoser.#below(input.clearedWithin7DaysPct, POOR)) {
      found.push("city_response");
    }
    if ((input.redumpedPct ?? 0) >= REPEAT_PCT) {
      found.push("repeat_spot");
    }
    return found;
  }

  static #below(value: number | null, limit: number): boolean {
    return value !== null && value < limit;
  }
}
