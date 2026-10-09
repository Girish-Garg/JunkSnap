import type { ModerationResult } from "../../contracts/index.gen.js";
import { InternalDataError } from "../errors.js";
import { CheckOutcome } from "./CheckOutcome.js";
import type { CheckKey, CheckRecord, RejectReason } from "./types.js";

// Outcome of every authenticity check, in chain order; `reason` comes from the first failure.
export class AuthenticityReport {
  readonly reason: RejectReason | null;
  readonly #outcomes: ReadonlyMap<CheckKey, CheckOutcome>;

  constructor(outcomes: ReadonlyMap<CheckKey, CheckOutcome>, reason: RejectReason | null) {
    this.#outcomes = outcomes;
    this.reason = reason;
  }

  static skippedAll(keys: readonly CheckKey[], detail: string): AuthenticityReport {
    return new AuthenticityReport(new Map(keys.map((key) => [key, CheckOutcome.skipped(detail)])), null);
  }

  get duplicateOf(): string | null {
    return [...this.#outcomes.values()].find((outcome) => outcome.duplicateOf !== null)?.duplicateOf ?? null;
  }

  toContract(): ModerationResult["checks"] {
    const checks = {
      inside_india: this.#record("inside_india"),
      fresh_timestamp: this.#record("fresh_timestamp"),
      duplicate: this.#record("duplicate"),
      rate_limit: this.#record("rate_limit"),
      device_token: this.#record("device_token"),
    };
    return this.#outcomes.has("near_site") ? { ...checks, near_site: this.#record("near_site") } : checks;
  }

  #record(key: CheckKey): CheckRecord {
    const outcome = this.#outcomes.get(key);
    if (outcome === undefined) {
      throw new InternalDataError(`authenticity check ${key} never ran`);
    }
    return outcome.toContract();
  }
}
