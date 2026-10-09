import type { FastifyRequest } from "fastify";

// Who acts on a site POST route: the verified token's sub (decision 20261010-0227).
export interface SiteUsers {
  userIdOf(request: FastifyRequest): Promise<string>;
}
