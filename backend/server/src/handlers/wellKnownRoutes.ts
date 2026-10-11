import type { FastifyPluginAsync } from "fastify";
import { AssetLinks } from "../domain/android/AssetLinks.js";
import { AndroidAppSettings } from "../settings/AndroidAppSettings.js";
import { CacheSettings } from "../settings/CacheSettings.js";
import type { RouteContext } from "./RouteBuilder.js";
import { AssetLinksRoutes } from "./wellknown/AssetLinksRoutes.js";

// Files other systems fetch from a fixed path; CloudFront sends /.well-known/* to the api like every other path.
export function buildWellKnownRoutes(context: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const android = AndroidAppSettings.fromEnv(context.env);
    const links = new AssetLinks(android.packageName, android.certFingerprints);
    await app.register(new AssetLinksRoutes(links, CacheSettings.fromEnv(context.env).assetLinksMaxAgeSeconds).plugin());
  };
}
