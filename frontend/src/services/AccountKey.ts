import { JwtSubject } from '../domain/JwtSubject';
import type { RequestIdentity } from './ReportApi';

/**
 * An opaque key for the signed-in account: SHA-256 of the Cognito `sub` from the ID token, the same id the
 * api keeps as user_id. Never the email, and never the raw id on disk.
 */
export class AccountKey {
  readonly #identity: Pick<RequestIdentity, 'idToken'>;
  readonly #subtle: SubtleCrypto;

  constructor(identity: Pick<RequestIdentity, 'idToken'>, subtle: SubtleCrypto) {
    this.#identity = identity;
    this.#subtle = subtle;
  }

  /** Null when nobody is signed in, or no token can be had right now (then nothing is trusted). */
  async current(): Promise<string | null> {
    let token: string | null;
    try {
      token = await this.#identity.idToken();
    } catch {
      return null;
    }
    const sub = token === null ? null : JwtSubject.of(token);
    if (sub === null) return null;
    const digest = await this.#subtle.digest('SHA-256', new TextEncoder().encode(sub));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
