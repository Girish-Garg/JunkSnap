import { AuthenticityReport } from "../../domain/moderation/AuthenticityReport.js";
import { CheckOutcome } from "../../domain/moderation/CheckOutcome.js";
import type { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";
import type { CheckKey } from "../../domain/moderation/types.js";
import type { CheckFactory } from "./CheckFactory.js";
import type { Check, CheckSubject } from "./checks/Check.js";

const AFTER_FAILURE = "not run: an earlier check failed";

// Chain of responsibility: checks run in order and the first failure skips the rest.
export class AuthenticityService {
  readonly #factory: CheckFactory;

  constructor(factory: CheckFactory) {
    this.#factory = factory;
  }

  async verify(subject: CheckSubject): Promise<AuthenticityReport> {
    const outcomes = new Map<CheckKey, CheckOutcome>();
    let failed: Check | null = null;
    for (const check of this.#factory.checksFor(subject.submission)) {
      const outcome = failed === null ? await check.run(subject) : CheckOutcome.skipped(AFTER_FAILURE);
      outcomes.set(check.key, outcome);
      if (failed === null && outcome.failed) {
        failed = check;
      }
    }
    return new AuthenticityReport(outcomes, failed?.reason ?? null);
  }

  // For a photo rejected before the checks; `detail` says why none ran.
  skipAll(submission: PhotoSubmission, detail: string): AuthenticityReport {
    return AuthenticityReport.skippedAll(this.#factory.checksFor(submission).map((check) => check.key), detail);
  }
}
