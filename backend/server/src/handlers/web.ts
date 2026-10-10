import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import {
  fastify,
  LogController,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyPluginAsync,
} from "fastify";
import { JsonLoggerFactory } from "../adapters/JsonLoggerFactory.js";
import type { CoreSettings } from "../settings/CoreSettings.js";
import { EntryPoint, type EntryContext } from "./EntryPoint.js";
import { ErrorHandlerInstaller } from "./ErrorHandlerInstaller.js";
import { HttpErrorMapper } from "./HttpErrorMapper.js";
import { ROUTE_BUILDERS } from "./routes.js";

const HOST = "0.0.0.0";
const PORT = 8000;
const STOP_SIGNALS = ["SIGTERM", "SIGINT"] as const;

export async function createApp(
  settings: CoreSettings,
  routes: readonly FastifyPluginAsync[],
  logger: FastifyBaseLogger = new JsonLoggerFactory().create({ service: "api", stage: settings.stage }),
): Promise<FastifyInstance> {
  const origin = settings.allowedOrigins();
  const app = fastify({
    loggerInstance: logger,
    logController: new LogController({ requestIdLogLabel: "request_id" }),
    genReqId: () => randomUUID(),
    requestIdHeader: "x-request-id",
  });
  // DELETE is for withdrawing a report (decision 20261010-1700); the plugin allows only GET, HEAD and POST by default.
  await app.register(cors, { origin, methods: ["GET", "HEAD", "POST", "DELETE"] });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  new ErrorHandlerInstaller(new HttpErrorMapper()).install(app);
  app.get("/healthz", { logLevel: "silent" }, async () => ({ ok: true }));
  for (const route of routes) {
    await app.register(route);
  }
  return app;
}

export async function serveApi({ settings, logger, env }: EntryContext): Promise<void> {
  const routes = ROUTE_BUILDERS.map((build) => build({ core: settings, env }));
  const app = await createApp(settings, routes, logger);
  for (const signal of STOP_SIGNALS) {
    process.once(signal, () => void app.close());
  }
  await app.listen({ host: HOST, port: PORT });
}

if (import.meta.main) {
  await new EntryPoint({ service: "api" }).run(process.env, serveApi);
}
