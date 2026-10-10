import { AuthError, type AuthProblem } from '../domain/AuthError';

// Cognito exception names. The pool hides unknown users, so they arrive as NotAuthorizedException.
const PROBLEMS: Readonly<Record<string, AuthProblem>> = {
  NotAuthorizedException: 'wrong_credentials',
  UserNotFoundException: 'wrong_credentials',
  UserNotConfirmedException: 'not_confirmed',
  UsernameExistsException: 'exists',
  AliasExistsException: 'exists',
  CodeMismatchException: 'bad_code',
  ExpiredCodeException: 'bad_code',
  InvalidPasswordException: 'weak_password',
  LimitExceededException: 'too_many',
  TooManyRequestsException: 'too_many',
  TooManyFailedAttemptsException: 'too_many',
  TypeError: 'network',
  NetworkError: 'network',
  TimeoutError: 'network',
};

export class CognitoErrors {
  static translate(error: unknown): AuthError {
    if (error instanceof AuthError) return error;
    const name = error instanceof Error ? error.name : '';
    return new AuthError(PROBLEMS[name] ?? 'unknown', error instanceof Error ? error.message : String(error));
  }

  static async guard<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw CognitoErrors.translate(error);
    }
  }
}
