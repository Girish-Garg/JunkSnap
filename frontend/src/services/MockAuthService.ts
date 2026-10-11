import { AuthError } from '../domain/AuthError';
import type { KeyValueStore } from '../i18n/LanguagePreference';
import type { AuthService, AuthUser } from './AuthService';

interface Account {
  password: string;
  confirmed: boolean;
}

const SESSION_KEY = 'junksnap.session';
// Every "emailed" code is this one; the code fields show it as a hint.
const MOCK_CODE = '123456';

/** In-memory accounts for mock mode; the session survives reloads through the store. */
export class MockAuthService implements AuthService {
  readonly #store: KeyValueStore;
  readonly #delayMs: number;
  readonly #accounts = new Map<string, Account>();
  readonly #listeners = new Set<() => void>();
  #user: AuthUser | null;

  constructor(store: KeyValueStore, delayMs = 400) {
    this.#store = store;
    this.#delayMs = delayMs;
    const saved = store.getItem(SESSION_KEY);
    this.#user = saved ? { email: saved } : null;
  }

  available(): boolean {
    return true;
  }

  // The constructor already read the saved session.
  async restore(): Promise<void> {}

  restoring(): boolean {
    return false;
  }

  currentUser(): AuthUser | null {
    return this.#user;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    await this.#wait();
    const account = this.#accounts.get(MockAuthService.#key(email));
    if (!account || account.password !== password) throw new AuthError('wrong_credentials', 'Wrong email or password');
    if (!account.confirmed) throw new AuthError('not_confirmed', 'Email not verified');
    return this.#setUser(email);
  }

  async signUp(email: string, password: string): Promise<void> {
    await this.#wait();
    const key = MockAuthService.#key(email);
    if (this.#accounts.get(key)?.confirmed) throw new AuthError('exists', 'Account exists');
    this.#accounts.set(key, { password, confirmed: false });
  }

  async confirmSignUp(email: string, code: string): Promise<AuthUser> {
    await this.#wait();
    const account = this.#accounts.get(MockAuthService.#key(email));
    if (!account || code !== MOCK_CODE) throw new AuthError('bad_code', 'Wrong code');
    account.confirmed = true;
    return this.#setUser(email);
  }

  async resendCode(): Promise<void> {
    await this.#wait();
  }

  async forgotPassword(): Promise<void> {
    await this.#wait();
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await this.#wait();
    if (code !== MOCK_CODE) throw new AuthError('bad_code', 'Wrong code');
    const account = this.#accounts.get(MockAuthService.#key(email));
    if (account) account.password = newPassword;
  }

  async signOut(): Promise<void> {
    this.#store.setItem(SESSION_KEY, '');
    this.#user = null;
    this.#notify();
  }

  sampleCode(): string {
    return MOCK_CODE;
  }

  // A placeholder token so the mock report api sends only for a signed-in user, like the real one. It is
  // shaped like a JWT with a stable sample `sub` per account (unsigned: nothing checks it in mock mode).
  async idToken(): Promise<string | null> {
    return this.#user ? MockAuthService.#token(this.#user.email) : null;
  }

  #setUser(email: string): AuthUser {
    this.#user = { email: MockAuthService.#key(email) };
    this.#store.setItem(SESSION_KEY, this.#user.email);
    this.#notify();
    return this.#user;
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }

  #wait(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.#delayMs));
  }

  static #token(email: string): string {
    // FNV-1a, so the sample sub is stable per account without being the email.
    let hash = 0x811c9dc5;
    for (const char of email) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    const part = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${part({ alg: 'none' })}.${part({ sub: `sample-${hash.toString(16)}` })}.sample`;
  }

  static #key(email: string): string {
    return email.trim().toLowerCase();
  }
}
