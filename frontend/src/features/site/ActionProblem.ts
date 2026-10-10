import { ErrorClassifier, type ClassifiedError, type ErrorCategory } from '../../domain/ErrorClassifier';

// Every action namespace (vote, cleanup, letter, notes, withdraw, activityDelete) has these three under errors.*.
const BY_CATEGORY: Readonly<Partial<Record<ErrorCategory, string>>> = {
  offline: 'offline',
  network: 'offline',
  auth_expired: 'sign_in',
};

/**
 * Turns a failed vote, cleanup claim, note, withdrawal or letter into the key of a plain message under the action's
 * errors.*: the api code when the action words it itself, else offline, sign_in or failed. Never the server's text.
 */
export class ActionProblem {
  /** known: the codes this action words itself; add location only where the action has its own line for it. */
  static of(error: unknown, known: ReadonlySet<string>, online = true): string {
    return ActionProblem.from(ErrorClassifier.classify(error, online), known);
  }

  // A 401 here already survived one forced token refresh (SignedInStep), so the session is over.
  static from(error: ClassifiedError, known: ReadonlySet<string>): string {
    if (known.has(error.code)) return error.code;
    return BY_CATEGORY[error.category] ?? 'failed';
  }
}
