import { CognitoJwtVerifier } from "aws-jwt-verify";
import { FetchError, JwtBaseError, JwtExpiredError } from "aws-jwt-verify/error";
import type { Jwks } from "aws-jwt-verify/jwk";
import { ExternalServiceError, UnauthorizedError, type JunkSnapError } from "../domain/errors.js";
import type { AuthUser, Authenticator } from "../ports/Authenticator.js";
import type { AuthSettings } from "../settings/AuthSettings.js";

const EXPIRED = "Your sign-in has expired. Please sign in again.";
const INVALID = "Your sign-in is not valid. Please sign in again.";

interface IdTokenVerifier {
  verify(token: string): Promise<{ readonly sub?: unknown }>;
  cacheJwks(jwks: Jwks): void;
}

// Checks Cognito ID tokens: signature against the pool JWKS, issuer, client id (aud), token_use and expiry.
export class CognitoAuthenticator implements Authenticator {
  readonly #verifier: IdTokenVerifier;

  // The verifier downloads the JWKS on first use and keeps it; `jwks` preloads it instead.
  constructor(settings: AuthSettings, jwks?: Jwks) {
    this.#verifier = CognitoJwtVerifier.create({
      userPoolId: settings.userPoolId,
      clientId: settings.clientId,
      tokenUse: "id",
    });
    if (jwks !== undefined) {
      this.#verifier.cacheJwks(jwks);
    }
  }

  async verify(token: string): Promise<AuthUser> {
    let sub: unknown;
    try {
      ({ sub } = await this.#verifier.verify(token));
    } catch (error) {
      throw CognitoAuthenticator.#translate(error);
    }
    if (typeof sub !== "string" || sub === "") {
      throw new UnauthorizedError(INVALID);
    }
    return { userId: sub };
  }

  static #translate(error: unknown): JunkSnapError {
    if (error instanceof FetchError) {
      return new ExternalServiceError("Could not fetch the Cognito signing keys", { cause: error });
    }
    if (error instanceof JwtBaseError) {
      return new UnauthorizedError(error instanceof JwtExpiredError ? EXPIRED : INVALID, { cause: error });
    }
    return new ExternalServiceError("Cognito token check failed", { cause: error });
  }
}
