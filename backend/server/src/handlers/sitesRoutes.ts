import type { FastifyPluginAsync } from "fastify";
import type { RouteContext } from "./RouteBuilder.js";
import { GuestSiteUsers } from "./sites/GuestSiteUsers.js";
import { SiteRoutes } from "./sites/SiteRoutes.js";
import { SiteServiceFactory } from "./sites/SiteServiceFactory.js";

// Settings load when the plugin registers, after createApp has checked CORS_ORIGINS.
export function buildSitesRoutes(context: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const factory = SiteServiceFactory.fromEnv(context.core, context.env, app.log);
    const users = new GuestSiteUsers();
    const deps = { finder: factory.finder(), votes: factory.voteService(), cleanups: factory.cleanupIntake(), users };
    await app.register(new SiteRoutes(deps).plugin());
  };
}
