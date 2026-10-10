import type { ReportUpload, VerificationResult } from "../contracts/index.gen.js";
import type { ConfirmationAnswer, ConfirmationRecord, ReportRecord, ReportStatus } from "./ReportRecord.js";

// When the verify step asked, and when the reporter's window closes; ISO seconds.
export interface AskedWindow {
  readonly askedAt: string;
  readonly expiresAt: string;
}

// recorded: this call answered; repeated: the same answer was already stored; expired and closed both mean 409.
export type ConfirmOutcome = "recorded" | "repeated" | "expired" | "closed";

export interface ConfirmTransition {
  readonly outcome: ConfirmOutcome;
  readonly changes: Partial<ReportRecord>;
}

const TYPE_LABELS: Readonly<Record<ReportUpload["report_type"], string>> = {
  waste_dump: "a waste dump",
  overflowing_bin: "an overflowing or broken bin",
  contaminated_water: "contaminated water",
  open_construction: "open construction debris",
  no_bin: "a place without a dustbin",
};
const REASONING_MAX = 300;

// The reporter's check when the judge was unsure (contracts v1.16): asked once, answered once, or closed by its window.
export class ReportConfirmation {
  readonly #record: ConfirmationRecord;

  private constructor(record: ConfirmationRecord) {
    this.#record = Object.freeze({ ...record });
  }

  static ask(reportType: ReportUpload["report_type"], verification: VerificationResult, window: AskedWindow): ReportConfirmation {
    return new ReportConfirmation({
      question: `Our check wasn't sure this shows ${TYPE_LABELS[reportType]}. Only report it if you're 100% sure.`,
      reasoning: ReportConfirmation.reasoning(verification.judge?.rationale ?? ""),
      report_type: reportType,
      asked_at: window.askedAt,
      expires_at: window.expiresAt,
      answer: null,
      answered_at: null,
    });
  }

  static of(record: ConfirmationRecord): ReportConfirmation {
    return new ReportConfirmation(record);
  }

  // Control characters removed (line breaks and tabs count as spaces), whitespace collapsed, at most 300 characters.
  static reasoning(rationale: string): string {
    const printable = rationale.replace(/\p{Cc}/gu, (char) => (/\s/u.test(char) ? " " : ""));
    const collapsed = printable.replace(/\s+/gu, " ").trim();
    return Array.from(collapsed).slice(0, REASONING_MAX).join("").trimEnd();
  }

  toRecord(): ConfirmationRecord {
    return this.#record;
  }

  // A report still waiting past its window reads as not_confirmed; null while it stands as it is.
  expiry(status: ReportStatus, now: string): Partial<ReportRecord> | null {
    return status === "needs_confirmation" && this.#closedAt(now) ? this.#expired(now) : null;
  }

  // sure resumes the pipeline, not sure withdraws the report; a retry with the stored answer changes nothing.
  answer(status: ReportStatus, sure: boolean, now: string): ConfirmTransition {
    const wanted: ConfirmationAnswer = sure ? "sure" : "withdrawn";
    if (status !== "needs_confirmation") {
      return { outcome: this.#record.answer === wanted ? "repeated" : "closed", changes: {} };
    }
    if (this.#closedAt(now)) {
      return { outcome: "expired", changes: this.#expired(now) };
    }
    const confirmation = { ...this.#record, answer: wanted, answered_at: now };
    const after = sure ? { status: "processing" as const } : { status: "withdrawn" as const, withdrawn_at: now };
    return { outcome: "recorded", changes: { ...after, confirmation, updated_at: now } };
  }

  #closedAt(now: string): boolean {
    return Date.parse(now) >= Date.parse(this.#record.expires_at);
  }

  #expired(now: string): Partial<ReportRecord> {
    const confirmation = { ...this.#record, answer: "expired" as const, answered_at: this.#record.expires_at };
    return { status: "not_confirmed", confirmation, updated_at: now };
  }
}
