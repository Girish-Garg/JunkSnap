import type {
  confirmResetPassword,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
  SignInOutput,
} from '@aws-amplify/auth';
import { AuthError } from '../domain/AuthError';
import type { AuthService, AuthUser } from './AuthService';
import { CognitoErrors } from './CognitoErrors';

/** The Amplify Auth calls the app uses, injected so tests can fake them. */
export interface AmplifyAuthApi {
  readonly signIn: typeof signIn;
  readonly signUp: typeof signUp;
  readonly confirmSignUp: typeof confirmSignUp;
  readonly resendSignUpCode: typeof resendSignUpCode;
  readonly resetPassword: typeof resetPassword;
  readonly confirmResetPassword: typeof confirmResetPassword;
  readonly signOut: typeof signOut;
  readonly fetchAuthSession: typeof fetchAuthSession;
}

interface PendingSignUp {
  readonly email: string;
  readonly password: string;
}

/** Email and password accounts in the stage's Cognito user pool, through Amplify Auth (SRP sign-in). */
export class AmplifyAuthService implements AuthService {
  readonly #api: AmplifyAuthApi;
  readonly #listeners = new Set<() => void>();
  #user: AuthUser | null = null;
  // Memory only: lets the code step sign in without asking for the password again.
  #pending: PendingSignUp | null = null;

  constructor(api: AmplifyAuthApi) {
    this.#api = api;
  }

  available(): boolean {
    return true;
  }

  /** Offline at start leaves a guest until the next sign-in or token read. */
  async restore(): Promise<void> {
    await this.idToken().catch(() => null);
  }

  currentUser(): AuthUser | null {
    return this.#user;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const username = AmplifyAuthService.#key(email);
    const result = await CognitoErrors.guard(() => this.#signInFresh(username, password));
    if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') return this.#needsCode(username, password);
    if (!result.isSignedIn) throw new AuthError('unknown', `Sign-in asks for ${result.nextStep.signInStep}`);
    await this.idToken();
    if (!this.#user) throw new AuthError('unknown', 'The ID token has no email');
    return this.#user;
  }

  async signUp(email: string, password: string): Promise<void> {
    const username = AmplifyAuthService.#key(email);
    const options = { userAttributes: { email: username } };
    await CognitoErrors.guard(() => this.#api.signUp({ username, password, options }));
    this.#pending = { email: username, password };
  }

  async confirmSignUp(email: string, code: string): Promise<AuthUser | null> {
    const username = AmplifyAuthService.#key(email);
    await CognitoErrors.guard(() => this.#api.confirmSignUp({ username, confirmationCode: code }));
    const pending = this.#pending;
    this.#pending = null;
    return pending?.email === username ? this.signIn(username, pending.password) : null;
  }

  async resendCode(email: string): Promise<void> {
    await CognitoErrors.guard(() => this.#api.resendSignUpCode({ username: AmplifyAuthService.#key(email) }));
  }

  async forgotPassword(email: string): Promise<void> {
    await CognitoErrors.guard(() => this.#api.resetPassword({ username: AmplifyAuthService.#key(email) }));
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const input = { username: AmplifyAuthService.#key(email), confirmationCode: code, newPassword };
    await CognitoErrors.guard(() => this.#api.confirmResetPassword(input));
  }

  async signOut(): Promise<void> {
    // Amplify clears the tokens on this phone even when the revoke call fails.
    await this.#api.signOut().catch(() => undefined);
    this.#setUser(null);
  }

  /** Amplify refreshes an expired ID token with the refresh token. */
  async idToken(): Promise<string | null> {
    const session = await CognitoErrors.guard(() => this.#api.fetchAuthSession());
    const token = session.tokens?.idToken;
    const email = token?.payload.email;
    this.#setUser(typeof email === 'string' ? { email } : null);
    return token ? token.toString() : null;
  }

  sampleCode(): null {
    return null;
  }

  // A session Amplify still holds (another tab, a slow restore) would block a new sign-in.
  async #signInFresh(username: string, password: string): Promise<SignInOutput> {
    try {
      return await this.#api.signIn({ username, password });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'UserAlreadyAuthenticatedException') throw error;
      await this.#api.signOut();
      return this.#api.signIn({ username, password });
    }
  }

  // An unverified account goes to the code step, with a fresh code.
  async #needsCode(username: string, password: string): Promise<never> {
    this.#pending = { email: username, password };
    await this.#api.resendSignUpCode({ username }).catch(() => undefined);
    throw new AuthError('not_confirmed', 'Email not verified');
  }

  #setUser(user: AuthUser | null): void {
    if (user?.email === this.#user?.email) return;
    this.#user = user;
    for (const listener of this.#listeners) listener();
  }

  static #key(email: string): string {
    return email.trim().toLowerCase();
  }
}
