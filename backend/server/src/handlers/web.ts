import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import {
  fastify,
  LogController,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyPluginAsync,
} from "fastify";
import { CoreSettings } from "../settings/CoreSettings.js";
import type { Env } from "../settings/utils.js";
import { HttpErrorMapper } from "./HttpErrorMapper.js";
import { createLogger } from "./logger.js";
import { ROUTE_BUILDERS } from "./routes.js";

const HOST = "0.0.0.0";
const PORT = 8000;
const STOP_SIGNALS = ["SIGTERM", "SIGINT"] as const;

export async function createApp(
  settings: CoreSettings,
  routes: readonly FastifyPluginAsync[],
  logger: FastifyBaseLogger = createLogger({ service: "api", stage: settings.stage }),
): Promise<FastifyInstance> {
  const app = fastify({
    loggerInstance: logger,
    logController: new LogController({ requestIdLogLabel: "request_id" }),
    genReqId: () => randomUUID(),
    requestIdHeader: "x-request-id",
  });
  await app.register(cors, { origin: settings.allowsAnyOrigin ? "*" : [...settings.corsOrigins] });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  addErrorHandling(app, new HttpErrorMapper());
  app.get("/healthz", { logLevel: "silent" }, async () => ({ ok: true }));
  for (const route of routes) {
    await app.register(route);
  }
  return app;
}

function addErrorHandling(app: FastifyInstance, errors: HttpErrorMapper): void {
  app.setErrorHandler(async (error, request, reply) => {
    const response = errors.map(error);
    if (response.status >= 500) {
      request.log.error({ err: error }, "request failed");
    }
    return reply.status(response.status).send(response.body);
  });
  app.setNotFoundHandler(async (request, reply) => {
    const message = `No route for ${request.method} ${request.url}`;
    return reply.status(404).send({ error: "not_found", message });
  });
}

async function main(env: Env): Promise<void> {
  const settings = CoreSettings.fromEnv(env);
  const routes = ROUTE_BUILDERS.map((build) => build({ core: settings, env }));
  const app = await createApp(settings, routes);
  for (const signal of STOP_SIGNALS) {
    process.once(signal, () => void app.close());
  }
  await app.listen({ host: HOST, port: PORT });
}

if (import.meta.main) {
  await main(process.env);
}
