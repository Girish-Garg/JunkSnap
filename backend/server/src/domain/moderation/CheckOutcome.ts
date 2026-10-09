import type { CheckRecord } from "./types.js";

export class CheckOutcome {
  readonly result: CheckRecord["result"];
  readonly detail: string;
  // The earlier photo this one duplicates; set only by a failed duplicate check.
  readonly duplicateOf: string | null;

  private constructor(result: CheckRecord["result"], detail: string, duplicateOf: string | null) {
    this.result = result;
    this.detail = detail;
    this.duplicateOf = duplicateOf;
  }

  static pass(detail: string): CheckOutcome {
    return new CheckOutcome("pass", detail, null);
  }

  static fail(detail: string, duplicateOf: string | null = null): CheckOutcome {
    return new CheckOutcome("fail", detail, duplicateOf);
  }

  static skipped(detail: string): CheckOutcome {
    return new CheckOutcome("skipped", detail, null);
  }

  get failed(): boolean {
    return this.result === "fail";
  }

  toContract(): CheckRecord {
    return { result: this.result, detail: this.detail };
  }
}
