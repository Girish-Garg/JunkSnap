import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import type { WardScores } from "../../src/contracts/index.gen.js";
import type { ComputedAreaScores } from "../../src/domain/AreaInsights.js";
import { ConfigError } from "../../src/domain/errors.js";
import { areaScoresRoutes, buildAreaScoresRoutes } from "../../src/handlers/areaScoresRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import { AreaListQuery } from "../../src/services/AreaListQuery.js";
import { AreaScoresQuery } from "../../src/services/AreaScoresQuery.js";
import { ScoreCalculator } from "../../src/services/ScoreCalculator.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { InMemoryScores } from "./InMemoryScores.js";
import { NO_FACTS, NOW, readContract, site, WARD } from "./siteBuilder.js";

const fixture = (sample: string) => readContract<WardScores>(`fixtures/ward_scores.${sample}.json`);
const urlOf = (row: Pick<WardScores, "area">) => `/areas/${row.area.kind}/${row.area.id}/scores`;

const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
let app: FastifyInstance | undefined;

async function start(routes: FastifyPluginAsync): Promise<FastifyInstance> {
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(core, [routes], logger);
  return app;
}

async function startWithRows(rows: readonly (ComputedAreaScores | WardScores)[]): Promise<FastifyInstance> {
  const scores = new InMemoryScores();
  for (const row of rows) {
    await scores.save(row);
  }
  return start(areaScoresRoutes({ scores: new AreaScoresQuery(scores), list: new AreaListQuery(scores) }));
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /areas/{kind}/{id}/scores", () => {
  it("returns the stored row", async () => {
    const row = fixture("jdh-1");
    const response = await (await startWithRows([row])).inject({ url: urlOf(row) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(row);
  });

  it("returns 200 with zero counts and withheld scores for a seeded area", async () => {
    const row = fixture("jpr-1");
    const response = await (await startWithRows([row])).inject({ url: urlOf(row) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      counts: { verified_reports: 0 },
      scores: { city: { value: null, reason: "too_few_reports" } },
      diagnosis: [],
    });
  });

  it("returns a computed row with its insights", async () => {
    const row = ScoreCalculator.standard().calculate({ area: WARD, sites: [site()], facts: NO_FACTS, now: NOW });
    const response = await (await startWithRows([row])).inject({ url: urlOf(row) });
    expect(response.json()).toMatchObject({ insights: { repeat_spots: { value: [], count: 0, reason: null } } });
  });

  it("returns 404 area_not_found for an area with no sites", async () => {
    const response = await (await startWithRows([])).inject({ url: "/areas/ward/jodhpur-mc-w99/scores" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "area_not_found" });
  });

  it.each([
    ["/areas/city/jodhpur/scores", "kind"],
    ["/areas/ward/Ward%2037/scores", "id"],
  ])("returns 400 bad_request for %s", async (url, field) => {
    const response = await (await startWithRows([])).inject({ url });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request", message: expect.stringContaining(field) });
  });
});

describe("buildAreaScoresRoutes", () => {
  it("registers with SCORES_TABLE set", async () => {
    const routes = buildAreaScoresRoutes({ core, env: { SCORES_TABLE: "junksnap-dev-scores" } });
    await expect(start(routes)).resolves.toBeDefined();
  });

  it("refuses to start without SCORES_TABLE", async () => {
    await expect(start(buildAreaScoresRoutes({ core, env: {} }))).rejects.toThrow(ConfigError);
  });
});
