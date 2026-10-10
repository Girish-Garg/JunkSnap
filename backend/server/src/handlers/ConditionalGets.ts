import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { EntityTag } from "../domain/EntityTag.js";

/** Who may keep a copy: anyone (open routes) or only the signed-in owner's own browser. */
export type CacheScope = "public" | "private";

const CACHE_CONTROL: Readonly<Record<CacheScope, string>> = {
  public: "no-cache",
  private: "private, no-cache",
};
const OK = 200;
const NOT_MODIFIED = 304;
const READS = new Set(["GET", "HEAD"]);

// The tag is a hash of the body the handler already built, so an owner-only route has run its owner check first.
export class ConditionalGets {
  readonly #routes: Readonly<Record<string, CacheScope>>;

  constructor(routes: Readonly<Record<string, CacheScope>>) {
    this.#routes = routes;
  }

  install(app: FastifyInstance): void {
    app.addHook("onSend", async (request, reply, payload) => this.#tag(request, reply, payload));
  }

  #tag(request: FastifyRequest, reply: FastifyReply, payload: unknown): unknown {
    const scope = this.#scopeOf(request, reply);
    if (scope === null || !(typeof payload === "string" || payload instanceof Uint8Array)) {
      return payload;
    }
    const tag = EntityTag.ofBody(payload);
    reply.header("etag", tag.toHeader());
    reply.header("cache-control", CACHE_CONTROL[scope]);
    if (!tag.matchedBy(request.headers["if-none-match"])) {
      return payload;
    }
    reply.code(NOT_MODIFIED);
    return null;
  }

  #scopeOf(request: FastifyRequest, reply: FastifyReply): CacheScope | null {
    if (reply.statusCode !== OK || !READS.has(request.method)) {
      return null;
    }
    return this.#routes[request.routeOptions.url ?? ""] ?? null;
  }
}
