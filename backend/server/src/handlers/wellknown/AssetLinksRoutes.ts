import type { FastifyPluginAsync } from "fastify";
import type { AssetLinks } from "../../domain/android/AssetLinks.js";
import { NotFoundError } from "../../domain/errors.js";

// Android re-reads it when the app is installed or updated; nothing personal is in it.
const CACHE = "public, max-age=3600";

// GET /.well-known/assetlinks.json (contracts/README.md, Routes): verifies the app's https links. 404 until
// ANDROID_CERT_SHA256 is set.
export class AssetLinksRoutes {
  readonly #links: AssetLinks;

  constructor(links: AssetLinks) {
    this.#links = links;
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.get("/.well-known/assetlinks.json", async (_request, reply) => {
        if (!this.#links.configured()) throw new NotFoundError("No Android app links are configured");
        return reply.header("content-type", "application/json").header("cache-control", CACHE).send(this.#links.statements());
      });
    };
  }
}
