/**
 * The `sub` claim of a Cognito ID token: the opaque account id the api also stores as user_id. Only read on
 * this phone to tell accounts apart; the signature is the api's to check, never the app's.
 */
export class JwtSubject {
  static of(token: string): string | null {
    const payload = token.split('.')[1];
    if (!payload) return null;
    try {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const claims: unknown = JSON.parse(atob(base64));
      const sub = typeof claims === 'object' && claims !== null ? (claims as { sub?: unknown }).sub : undefined;
      return typeof sub === 'string' && sub.length > 0 ? sub : null;
    } catch {
      return null;
    }
  }
}
