import { JunkSnapError } from './JunkSnapError';

export type AuthProblem = 'wrong_credentials' | 'exists' | 'bad_code' | 'not_confirmed' | 'unknown';

export class AuthError extends JunkSnapError {
  readonly problem: AuthProblem;

  constructor(problem: AuthProblem, message: string) {
    super(message);
    this.problem = problem;
  }
}
