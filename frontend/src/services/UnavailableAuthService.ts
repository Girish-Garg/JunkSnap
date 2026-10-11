import { AuthError } from '../domain/AuthError';
import type { AuthService, AuthUser } from './AuthService';

/** Live mode without VITE_COGNITO_* set: nobody is signed in and every call says so. */
export class UnavailableAuthService implements AuthService {
  available(): boolean {
    return false;
  }

  async restore(): Promise<void> {}

  restoring(): boolean {
    return false;
  }

  async idToken(): Promise<null> {
    return null;
  }

  currentUser(): AuthUser | null {
    return null;
  }

  subscribe(): () => void {
    return () => undefined;
  }

  signIn(): Promise<AuthUser> {
    return UnavailableAuthService.#refuse();
  }

  signUp(): Promise<void> {
    return UnavailableAuthService.#refuse();
  }

  confirmSignUp(): Promise<AuthUser> {
    return UnavailableAuthService.#refuse();
  }

  resendCode(): Promise<void> {
    return UnavailableAuthService.#refuse();
  }

  forgotPassword(): Promise<void> {
    return UnavailableAuthService.#refuse();
  }

  resetPassword(): Promise<void> {
    return UnavailableAuthService.#refuse();
  }

  signOut(): Promise<void> {
    return Promise.resolve();
  }

  sampleCode(): string | null {
    return null;
  }

  static #refuse<T>(): Promise<T> {
    return Promise.reject(new AuthError('unavailable', 'Sign-in is not available in live mode yet'));
  }
}
