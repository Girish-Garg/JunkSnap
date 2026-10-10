import { ApiError } from '../../domain/ApiError';
import { AuthError } from '../../domain/AuthError';
import { LocationError } from '../../domain/LocationError';

/** Turns a failed vote, cleanup claim or letter into the key of a plain message. */
export class ActionProblem {
  /** known: the api error codes this action explains on its own. */
  static of(error: unknown, known: ReadonlySet<string>): string {
    if (error instanceof LocationError) return 'location';
    if (error instanceof AuthError) return error.problem === 'network' ? 'offline' : 'sign_in';
    if (error instanceof ApiError) return ActionProblem.#api(error, known);
    return 'failed';
  }

  // A 401 here already survived one forced token refresh, so the session is over.
  static #api(error: ApiError, known: ReadonlySet<string>): string {
    if (error.status === 0) return 'offline';
    if (error.status === 401) return 'sign_in';
    return known.has(error.code) ? error.code : 'failed';
  }
}
