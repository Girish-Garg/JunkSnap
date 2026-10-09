import type { FastifyPluginAsync } from "fastify";
import { RouteGuard } from "./auth/RouteGuard.js";
import type { RouteContext } from "./RouteBuilder.js";
import { GuardedSiteUsers } from "./sites/GuardedSiteUsers.js";
import { SiteRoutes } from "./sites/SiteRoutes.js";
import { SiteServiceFactory } from "./sites/SiteServiceFactory.js";

// Settings load when the plugin registers, after createApp has checked CORS_ORIGINS.
export function buildSitesRoutes(context: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const factory = SiteServiceFactory.fromEnv(context.core, context.env, app.log);
    const users = new GuardedSiteUsers(RouteGuard.fromEnv(context.env));
    const deps = { finder: factory.finder(), votes: factory.voteService(), cleanups: factory.cleanupIntake(), users };
    await app.register(new SiteRoutes(deps).plugin());
  };
}
