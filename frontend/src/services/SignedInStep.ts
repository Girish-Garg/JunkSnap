import { ApiError } from '../domain/ApiError';
import { AuthError } from '../domain/AuthError';
import type { RequestIdentity } from './ReportApi';

/** Creating anything needs a signed-in user (decision 20261010-0227): no token, no request. */
export class SignedInStep {
  readonly #identity: RequestIdentity;

  constructor(identity: RequestIdentity) {
    this.#identity = identity;
  }

  async run<T>(step: () => Promise<T>): Promise<T> {
    if (!(await this.#identity.idToken())) throw new AuthError('wrong_credentials', 'Sign in to send');
    try {
      return await step();
    } catch (error) {
      // A token the api refuses may be stale (revoked or clock skew): refresh once and try again.
      if (!(error instanceof ApiError && error.status === 401)) throw error;
      if (!(await this.#identity.idToken(true))) throw error;
      return step();
    }
  }
}
