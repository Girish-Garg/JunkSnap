import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { ConfigError } from "../../src/domain/errors.js";
import { ROUTE_BUILDERS } from "../../src/handlers/routes.js";
import { buildSitesRoutes } from "../../src/handlers/sitesRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { SITES_ENV as ENV } from "./sitesEnv.js";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function start(env: Record<string, string>): Promise<FastifyInstance> {
  const core = CoreSettings.fromEnv(env);
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: core.stage });
  app = await createApp(core, [buildSitesRoutes({ core, env })], logger);
  return app;
}

describe("buildSitesRoutes", () => {
  it("is registered with the api", () => {
    expect(ROUTE_BUILDERS).toContain(buildSitesRoutes);
  });

  it("serves the site routes from the environment, answering bad input before any AWS call", async () => {
    const response = await (await start(ENV)).inject({ url: "/sites?bbox=1,2" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
  });

  it.each(["votes", "cleanup"])("asks for sign-in on POST /sites/{id}/%s before any AWS call", async (route) => {
    const response = await (await start(ENV)).inject({ method: "POST", url: `/sites/site_jdh_1/${route}`, payload: {} });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });
  });

  it.each(["SITES_TABLE", "COGNITO_USER_POOL_ID"])("refuses to start without %s", async (name) => {
    const rest = Object.fromEntries(Object.entries(ENV).filter(([key]) => key !== name));
    await expect(start(rest)).rejects.toThrow(ConfigError);
    await expect(start(rest)).rejects.toThrow(new RegExp(name));
  });
});
