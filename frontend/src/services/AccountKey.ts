import type { AuthService } from './AuthService';
import type { MetaStore } from './ReportStore';

const SALT_KEY = 'activity.salt';

export interface AccountKeyPorts {
  readonly auth: Pick<AuthService, 'currentUser'>;
  readonly subtle: SubtleCrypto;
  /** Keeps this install's random salt. */
  readonly meta: MetaStore;
  readonly random: () => Uint8Array;
}

/**
 * An opaque key for the signed-in account, so the phone can tell accounts apart without storing who:
 * SHA-256 of a per-install random salt and the email. AuthService does not expose the Cognito sub, so the
 * salt keeps the key from being matched against a known email elsewhere.
 */
export class AccountKey {
  readonly #ports: AccountKeyPorts;

  constructor(ports: AccountKeyPorts) {
    this.#ports = ports;
  }

  /** Null when nobody is signed in. */
  async current(): Promise<string | null> {
    const email = this.#ports.auth.currentUser()?.email;
    if (!email) return null;
    const input = `${await this.#salt()}:${email.trim().toLowerCase()}`;
    return AccountKey.#hex(await this.#ports.subtle.digest('SHA-256', new TextEncoder().encode(input)));
  }

  async #salt(): Promise<string> {
    const saved = await this.#ports.meta.get(SALT_KEY);
    if (saved) return saved;
    const salt = AccountKey.#hex(this.#ports.random().buffer as ArrayBuffer);
    await this.#ports.meta.set(SALT_KEY, salt);
    return salt;
  }

  static #hex(bytes: ArrayBuffer): string {
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
