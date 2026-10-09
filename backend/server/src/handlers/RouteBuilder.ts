import type { FastifyPluginAsync } from "fastify";
import type { CoreSettings } from "../settings/CoreSettings.js";
import type { Env } from "../settings/utils.js";

export interface RouteContext {
  readonly core: CoreSettings;
  readonly env: Env;
}

// Loads its own settings from context.env, builds adapters then services, returns the routes.
export type RouteBuilder = (context: RouteContext) => FastifyPluginAsync;
