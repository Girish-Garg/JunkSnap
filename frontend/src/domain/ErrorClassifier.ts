import { ApiError } from './ApiError';
import { AuthError, type AuthProblem } from './AuthError';
import { CaptureError } from './CaptureError';
import { LocationError } from './LocationError';

/** What went wrong, in terms the person can act on; the UI picks its words from this, never from server text. */
export type ErrorCategory =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'auth_expired'
  | 'forbidden'
  | 'rate_limited'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'location'
  | 'camera'
  | 'unknown';

export interface ClassifiedError {
  readonly category: ErrorCategory;
  /** The api error code from contracts/README.md, or the category when the error carries none. */
  readonly code: string;
  /** HTTP status; 0 for no response; null for errors that are not HTTP. */
  readonly status: number | null;
  /** The same request can succeed later without the person changing anything. */
  readonly retryable: boolean;
}

type StatusRule = readonly [(status: number) => boolean, ErrorCategory];

// contracts/README.md "Errors": the status decides the category; the code stays for the action's own wording.
const BY_STATUS: readonly StatusRule[] = [
  [(status) => status === 401, 'auth_expired'],
  [(status) => status === 403, 'forbidden'],
  [(status) => status === 404, 'not_found'],
  [(status) => status === 409, 'conflict'],
  [(status) => status === 429, 'rate_limited'],
  [(status) => status >= 500, 'server'],
  [(status) => status >= 400, 'validation'],
];

const BY_AUTH_PROBLEM: Readonly<Partial<Record<AuthProblem, ErrorCategory>>> = {
  too_many: 'rate_limited',
  unavailable: 'server',
  unknown: 'unknown',
};

const RETRYABLE: ReadonlySet<ErrorCategory> = new Set(['offline', 'network', 'timeout', 'rate_limited', 'server', 'unknown']);
const nameOf = (value: unknown) => (typeof value === 'object' && value !== null ? String((value as { name?: unknown }).name) : '');

/** Sorts any thrown value into one category; online is the browser's own connection flag. */
export class ErrorClassifier {
  /** A request that ran out of time; DOMException is not always an Error, so read its name. */
  static isTimeout(value: unknown): boolean {
    return nameOf(value) === 'TimeoutError';
  }

  static classify(error: unknown, online: boolean): ClassifiedError {
    const [category, code, status] = ErrorClassifier.#parts(error, online);
    return { category, code, status, retryable: RETRYABLE.has(category) };
  }

  static #parts(error: unknown, online: boolean): readonly [ErrorCategory, string, number | null] {
    if (error instanceof ApiError) return ErrorClassifier.#api(error, online);
    if (error instanceof AuthError) return ErrorClassifier.#auth(error, online);
    if (error instanceof LocationError) return ['location', 'location', null];
    if (error instanceof CaptureError) return ['camera', error.problem, null];
    if (ErrorClassifier.isTimeout(error)) return ['timeout', 'timeout', 0];
    // The person or the app gave up on it, e.g. closed the share sheet: nothing to tell them.
    if (nameOf(error) === 'AbortError') return ['aborted', 'aborted', null];
    if (error instanceof TypeError) return ErrorClassifier.#lost(online);
    return ['unknown', 'unknown', null];
  }

  // Status 0 is no response at all: a timeout, or a connection that is gone or failing.
  static #api(error: ApiError, online: boolean): readonly [ErrorCategory, string, number | null] {
    if (error.status === 0) return error.code === 'timeout' ? ['timeout', 'timeout', 0] : ErrorClassifier.#lost(online);
    const category = BY_STATUS.find(([applies]) => applies(error.status))?.[1] ?? 'unknown';
    return [category, error.code, error.status];
  }

  static #auth(error: AuthError, online: boolean): readonly [ErrorCategory, string, number | null] {
    if (error.problem === 'network') return ErrorClassifier.#lost(online);
    return [BY_AUTH_PROBLEM[error.problem] ?? 'auth_expired', error.problem, null];
  }

  static #lost(online: boolean): readonly [ErrorCategory, string, number | null] {
    return online ? ['network', 'network_error', 0] : ['offline', 'offline', 0];
  }
}
