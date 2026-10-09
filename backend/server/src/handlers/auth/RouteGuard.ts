import type { FastifyRequest } from "fastify";
import { CognitoAuthenticator } from "../../adapters/CognitoAuthenticator.js";
import { UnauthorizedError } from "../../domain/errors.js";
import type { AuthUser, Authenticator } from "../../ports/Authenticator.js";
import { AuthSettings } from "../../settings/AuthSettings.js";
import type { Env } from "../../settings/utils.js";

const BEARER = /^Bearer +(\S+)$/i;

export type AuthRequest = Pick<FastifyRequest, "headers">;

// Build one per route module with fromEnv, so its JWKS cache lives as long as the api.
export class RouteGuard {
  readonly #authenticator: Authenticator;

  constructor(authenticator: Authenticator) {
    this.#authenticator = authenticator;
  }

  static fromEnv(env: Env): RouteGuard {
    return new RouteGuard(new CognitoAuthenticator(AuthSettings.fromEnv(env)));
  }

  async requireUser(request: AuthRequest): Promise<AuthUser> {
    const token = RouteGuard.#token(request);
    if (token === undefined) {
      throw new UnauthorizedError("Sign in to do this.");
    }
    return this.#authenticator.verify(token);
  }

  // No header means a guest; a header with a bad token is still 401, so the app knows to sign in again.
  async optionalUser(request: AuthRequest): Promise<AuthUser | undefined> {
    const token = RouteGuard.#token(request);
    return token === undefined ? undefined : this.#authenticator.verify(token);
  }

  static #token(request: AuthRequest): string | undefined {
    const header = request.headers.authorization;
    if (header === undefined) {
      return undefined;
    }
    const match = BEARER.exec(header);
    if (match?.[1] === undefined) {
      throw new UnauthorizedError("Send the sign-in token as Authorization: Bearer <token>.");
    }
    return match[1];
  }
}
