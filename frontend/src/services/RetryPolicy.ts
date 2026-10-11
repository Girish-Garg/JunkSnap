import { ApiError } from '../domain/ApiError';
import { AuthError } from '../domain/AuthError';
import type { SendProblem } from '../domain/QueuedReport';

const MINUTE_MS = 60_000;
const SERVER_FIRST_WAIT_MS = 30_000;
const LONGEST_WAIT_MS = 10 * MINUTE_MS;

// The api's error statuses (contracts/README.md); other 4xx mean the report itself was refused.
const BY_STATUS: Readonly<Record<number, SendProblem>> = { 0: 'offline', 401: 'sign_in', 408: 'server', 429: 'rate_limited' };

// Offline also retries on the online event; sign-in waits for the next sign-in.
const WAITS: Readonly<Record<SendProblem, (attempts: number) => number | null>> = {
  offline: () => 30_000,
  sign_in: () => null,
  rate_limited: () => 5 * MINUTE_MS,
  server: (attempts) => Math.min(SERVER_FIRST_WAIT_MS * 2 ** Math.max(attempts - 1, 0), LONGEST_WAIT_MS),
  refused: () => null,
};

/** Sorts a failed send into a problem and says when to try again. */
export class RetryPolicy {
  static problemOf(error: unknown): SendProblem {
    if (error instanceof AuthError) return error.problem === 'network' ? 'offline' : 'sign_in';
    if (!(error instanceof ApiError)) return 'server';
    // A timeout is not a lost connection: retrying every 30 s would restart a big upload from byte 0 each time.
    if (error.code === 'timeout') return 'server';
    return BY_STATUS[error.status] ?? (error.status >= 500 ? 'server' : 'refused');
  }

  static retryAt(problem: SendProblem, attempts: number, now: Date): Date | null {
    const wait = WAITS[problem](attempts);
    return wait === null ? null : new Date(now.getTime() + wait);
  }
}
