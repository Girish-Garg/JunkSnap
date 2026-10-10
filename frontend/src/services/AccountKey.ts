import type { AuthService } from './AuthService';

/** An opaque key for the signed-in account (SHA-256 of the email), so the phone can tell accounts apart without storing who. */
export class AccountKey {
  readonly #auth: Pick<AuthService, 'currentUser'>;
  readonly #subtle: SubtleCrypto;

  constructor(auth: Pick<AuthService, 'currentUser'>, subtle: SubtleCrypto) {
    this.#auth = auth;
    this.#subtle = subtle;
  }

  /** Null when nobody is signed in. */
  async current(): Promise<string | null> {
    const email = this.#auth.currentUser()?.email;
    if (!email) return null;
    const digest = await this.#subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
