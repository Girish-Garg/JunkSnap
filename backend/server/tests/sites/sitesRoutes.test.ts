import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { ConfigError } from "../../src/domain/errors.js";
import { ROUTE_BUILDERS } from "../../src/handlers/routes.js";
import { buildSitesRoutes } from "../../src/handlers/sitesRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";

const ENV = {
  JUNKSNAP_STAGE: "dev",
  SITES_TABLE: "junksnap-dev-sites",
  VOTES_TABLE: "junksnap-dev-votes",
  CLEANUPS_TABLE: "junksnap-dev-cleanups",
  REPORTS_TABLE: "junksnap-dev-reports",
  DEVICES_TABLE: "junksnap-dev-devices",
  SCORES_TABLE: "junksnap-dev-scores",
  ORIGINALS_BUCKET: "junksnap-dev-originals-000000000000",
  PUBLIC_BASE_URL: "https://d111111abcdef8.cloudfront.net",
  REPORTS_QUEUE_URL: "https://sqs.ap-south-1.amazonaws.com/000000000000/junksnap-dev-reports",
};

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

  it("refuses to start without the site tables", async () => {
    const rest = Object.fromEntries(Object.entries(ENV).filter(([key]) => key !== "SITES_TABLE"));
    await expect(start(rest)).rejects.toThrow(ConfigError);
    await expect(start(rest)).rejects.toThrow(/SITES_TABLE/);
  });
});
