import type { FastifyRequest } from "fastify";
import type { SiteUsers } from "./SiteUsers.js";

// The shape of RouteGuard.requireUser (server-34-auth): 401 unauthorized without a valid Cognito ID token.
export interface UserGuard {
  requireUser(request: Pick<FastifyRequest, "headers">): Promise<{ readonly userId: string }>;
}

export class GuardedSiteUsers implements SiteUsers {
  readonly #guard: UserGuard;

  constructor(guard: UserGuard) {
    this.#guard = guard;
  }

  async userIdOf(request: FastifyRequest): Promise<string> {
    const user = await this.#guard.requireUser(request);
    return user.userId;
  }
}
