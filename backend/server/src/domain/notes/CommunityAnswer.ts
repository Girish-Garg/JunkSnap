import type { AnswerSchema } from "../llm/AnswerSchema.js";
import { SIGNAL_FLAGS, type CommunitySignals } from "./Community.js";

const MAX_SUMMARY = 300;
const MAX_DAYS = 36_500;

export interface CommunityReading {
  readonly signals: CommunitySignals;
  readonly summary_en: string;
  readonly summary_hi: string;
}

type Parsed = { readonly success: true; readonly data: CommunityReading } | { readonly success: false };

// The note_analysis answer: the signals as booleans (recurring may be null), days or null, two short summaries.
export class CommunityAnswer implements AnswerSchema<CommunityReading> {
  safeParse(data: unknown): Parsed {
    if (typeof data !== "object" || data === null) {
      return { success: false };
    }
    const answer = data as Record<string, unknown>;
    const signals = CommunityAnswer.#signals(answer);
    const { summary_en: en, summary_hi: hi } = answer;
    const summariesFit = CommunityAnswer.#summary(en) && CommunityAnswer.#summary(hi);
    if (signals === null || !summariesFit) {
      return { success: false };
    }
    return { success: true, data: { signals, summary_en: String(en).trim(), summary_hi: String(hi).trim() } };
  }

  static #signals(answer: Record<string, unknown>): CommunitySignals | null {
    const days = answer.duration_days;
    const daysOk = days === null || (Number.isInteger(days) && Number(days) >= 0 && Number(days) <= MAX_DAYS);
    const flagsOk = SIGNAL_FLAGS.every((flag) => answer[flag] === null || typeof answer[flag] === "boolean");
    if (!daysOk || !flagsOk) {
      return null;
    }
    // Models answer null for "no note says"; only recurring keeps that, the others read it as false.
    const flags = Object.fromEntries(SIGNAL_FLAGS.map((flag) => [flag, flag === "recurring" ? answer[flag] : answer[flag] === true]));
    return { duration_days: days as number | null, ...flags } as CommunitySignals;
  }

  static #summary(value: unknown): boolean {
    return typeof value === "string" && value.trim() !== "" && value.length <= MAX_SUMMARY;
  }
}
