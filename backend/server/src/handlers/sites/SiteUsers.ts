import type { FastifyRequest } from "fastify";

// Who acts on a site POST route: the verified token's sub, or null for a guest.
export interface SiteUsers {
  userIdOf(request: FastifyRequest): Promise<string | null>;
}
