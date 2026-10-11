import type { FastifyPluginAsync } from "fastify";
import type { AssetLinks } from "../../domain/android/AssetLinks.js";
import { NotFoundError } from "../../domain/errors.js";
import { CacheSettings } from "../../settings/CacheSettings.js";

// GET /.well-known/assetlinks.json (contracts/README.md, Routes): verifies the app's https links. 404 until
// ANDROID_CERT_SHA256 is set.
export class AssetLinksRoutes {
  readonly #links: AssetLinks;
  readonly #cache: string;

  // Android re-reads it when the app is installed or updated (ASSETLINKS_CACHE_MAX_AGE_SECONDS); nothing personal is in it.
  constructor(links: AssetLinks, maxAgeSeconds = CacheSettings.fromEnv({}).assetLinksMaxAgeSeconds) {
    this.#links = links;
    this.#cache = CacheSettings.publicFor(maxAgeSeconds);
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.get("/.well-known/assetlinks.json", async (_request, reply) => {
        if (!this.#links.configured()) throw new NotFoundError("No Android app links are configured");
        return reply.header("content-type", "application/json").header("cache-control", this.#cache).send(this.#links.statements());
      });
    };
  }
}
