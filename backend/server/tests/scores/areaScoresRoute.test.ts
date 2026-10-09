import { readFileSync } from "node:fs";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import type { AreaScoresRow } from "../../src/domain/AreaInsights.js";
import type { AreaKey } from "../../src/domain/AreaKey.js";
import { ConfigError } from "../../src/domain/errors.js";
import { areaScoresRoutes, buildAreaScoresRoutes } from "../../src/handlers/areaScoresRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import type { ScoreRepository } from "../../src/ports/ScoreRepository.js";
import { AreaScoresQuery } from "../../src/services/AreaScoresQuery.js";
import { ScoreCalculator } from "../../src/services/ScoreCalculator.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { NO_FACTS, NOW, site, WARD } from "./siteBuilder.js";

function fixture(name: string): AreaScoresRow {
  const url = new URL(`../../../../contracts/fixtures/ward_scores.${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as AreaScoresRow;
}

class InMemoryScores implements ScoreRepository {
  readonly #rows = new Map<string, AreaScoresRow>();

  async save(row: AreaScoresRow): Promise<void> {
    this.#rows.set(`${row.area.kind}:${row.area.id}`, row);
  }

  async find(area: AreaKey): Promise<AreaScoresRow | null> {
    return this.#rows.get(area.toString()) ?? null;
  }
}

const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
let app: FastifyInstance | undefined;

async function start(routes: FastifyPluginAsync): Promise<FastifyInstance> {
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(core, [routes], logger);
  return app;
}

async function startWithRows(rows: readonly AreaScoresRow[]): Promise<FastifyInstance> {
  const scores = new InMemoryScores();
  for (const row of rows) {
    await scores.save(row);
  }
  return start(areaScoresRoutes(new AreaScoresQuery(scores)));
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /areas/{kind}/{id}/scores", () => {
  it("returns the stored row", async () => {
    const response = await (await startWithRows([fixture("jdh-1")])).inject({ url: "/areas/ward/jodhpur-south-mc-w37/scores" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(fixture("jdh-1"));
  });

  it("returns 200 with zero counts and withheld scores for a seeded area", async () => {
    const response = await (await startWithRows([fixture("jpr-1")])).inject({ url: "/areas/assembly/s20-ac-54/scores" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      counts: { verified_reports: 0 },
      scores: { city: { value: null, reason: "too_few_reports" } },
      diagnosis: [],
    });
  });

  it("returns a computed row with its insights", async () => {
    const row = ScoreCalculator.standard().calculate({ area: WARD, sites: [site()], facts: NO_FACTS, now: NOW });
    const response = await (await startWithRows([row])).inject({ url: `/areas/ward/${WARD.id}/scores` });
    expect(response.json()).toMatchObject({ insights: { repeat_spots: { value: [], count: 0, reason: null } } });
  });

  it("returns 404 area_not_found for an area with no sites", async () => {
    const response = await (await startWithRows([])).inject({ url: "/areas/ward/jodhpur-south-mc-w99/scores" });
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
