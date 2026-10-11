import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { FastifyRequest } from "fastify";
import { CognitoAuthenticator } from "../../adapters/CognitoAuthenticator.js";
import { DynamoUserStanding } from "../../adapters/DynamoUserStanding.js";
import { SystemClock } from "../../adapters/SystemClock.js";
import { ForbiddenError, UnauthorizedError } from "../../domain/errors.js";
import type { AuthUser, Authenticator } from "../../ports/Authenticator.js";
import type { UserStanding } from "../../ports/UserStanding.js";
import { CachedUserStanding } from "../../services/CachedUserStanding.js";
import { AuthSettings } from "../../settings/AuthSettings.js";
import type { Env } from "../../settings/utils.js";
import { TimeoutSettings } from "../../settings/TimeoutSettings.js";
import { awsClientConfig } from "../utils.js";

const BEARER = /^Bearer +(\S+)$/i;
// How long a users-row answer is reused; a new block takes effect within this.
const STANDING_TTL_MS = 60_000;

export type AuthRequest = Pick<FastifyRequest, "headers">;

// Build one per route module with fromEnv, so its JWKS and standing caches live as long as the api.
export class RouteGuard {
  readonly #authenticator: Authenticator;
  readonly #standing: UserStanding;

  constructor(authenticator: Authenticator, standing: UserStanding) {
    this.#authenticator = authenticator;
    this.#standing = standing;
  }

  static fromEnv(env: Env): RouteGuard {
    const settings = AuthSettings.fromEnv(env);
    const documents = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(settings.awsRegion, TimeoutSettings.fromEnv(env).aws.quick)));
    const standing = new CachedUserStanding(new DynamoUserStanding(documents, settings.usersTable), new SystemClock(), STANDING_TTL_MS);
    return new RouteGuard(new CognitoAuthenticator(settings), standing);
  }

  async requireUser(request: AuthRequest): Promise<AuthUser> {
    const token = RouteGuard.#token(request);
    if (token === undefined) {
      throw new UnauthorizedError("Sign in to do this.");
    }
    const user = await this.#authenticator.verify(token);
    if (await this.#standing.isBlocked(user.userId)) {
      throw new ForbiddenError("This account is blocked.");
    }
    return user;
  }

  // Browsing never 401s: a missing, malformed or expired token is a guest; a JWKS outage and a blocked user still fail.
  async optionalUser(request: AuthRequest): Promise<AuthUser | undefined> {
    try {
      return await this.requireUser(request);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return undefined;
      }
      throw error;
    }
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
