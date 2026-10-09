import type { FastifyPluginAsync } from "fastify";
import type { RouteContext } from "./RouteBuilder.js";
import { SiteRoutes } from "./sites/SiteRoutes.js";
import { SiteServiceFactory } from "./sites/SiteServiceFactory.js";

// Settings load when the plugin registers, after createApp has checked CORS_ORIGINS.
export function buildSitesRoutes(context: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const factory = SiteServiceFactory.fromEnv(context.core, context.env);
    const services = { finder: factory.finder(), votes: factory.voteService(), cleanups: factory.cleanupIntake() };
    await app.register(new SiteRoutes(services).plugin());
  };
}
