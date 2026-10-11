import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { validateAreaList, validateWardScores, type AreaList, type WardScores } from "../../src/contracts/index.gen.js";
import { AreaRanking } from "../../src/domain/AreaRanking.js";
import { areaScoresRoutes } from "../../src/handlers/areaScoresRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import { AreaListQuery } from "../../src/services/AreaListQuery.js";
import { AreaScoresQuery } from "../../src/services/AreaScoresQuery.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { InMemoryScores } from "./InMemoryScores.js";
import { readContract } from "./siteBuilder.js";
import { AREA_LIST } from "../defaults.js";

const JODHPUR = ["rajasthan-jodhpur", "jodhpur-mc"];
const JAIPUR = ["rajasthan-jaipur", "jaipur-mc"];
const shownRow = readContract<WardScores>("fixtures/ward_scores.jdh-1.json");
const withheldRow = readContract<WardScores>("fixtures/ward_scores.jpr-1.json");
const listFixture = readContract<AreaList>("fixtures/area_list.jdh-1.json");

type Scores = readonly [number | null, number | null, number | null];

function row(id: string, scores: Scores | null, verified: number, kind: WardScores["area"]["kind"] = "assembly"): WardScores {
  const base = scores === null ? withheldRow : shownRow;
  const score = (value: number | null) => (value === null ? { value, reason: "no_data" as const } : { value, reason: null });
  return {
    ...base,
    area: { kind, id, name: id },
    counts: { ...base.counts, verified_reports: verified },
    scores: scores === null ? base.scores : { city: score(scores[0]), citizen: score(scores[1]), bin_access: score(scores[2]) },
  };
}

const ids = (body: { areas: readonly WardScores[] }) => body.areas.map((area) => area.area.id);
let app: FastifyInstance | undefined;

async function startWith(rows: readonly (readonly [WardScores, readonly string[]])[]): Promise<{ app: FastifyInstance; scores: InMemoryScores }> {
  const scores = new InMemoryScores();
  for (const [stored, within] of rows) {
    await scores.save(stored, within);
  }
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  const routes = areaScoresRoutes({ scores: new AreaScoresQuery(scores), list: new AreaListQuery(scores, AREA_LIST) });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [routes], logger);
  return { app, scores };
}

async function listBody(url: string, rows: readonly (readonly [WardScores, readonly string[]])[]): Promise<AreaList & { areas: WardScores[] }> {
  const response = await (await startWith(rows)).app.inject({ url });
  expect(response.statusCode).toBe(200);
  const body = validateAreaList(response.json());
  return { ...body, areas: body.areas.map((area) => validateWardScores(area)) };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /areas/{kind}", () => {
  it("returns the area_list fixture body for the fixture rows, with no token", async () => {
    const stored = (listFixture.areas as WardScores[]).map((area) => [area, JODHPUR] as const).reverse();
    const body = await listBody("/areas/assembly?within=rajasthan-jodhpur", stored);
    expect(body).toEqual(listFixture);
  });

  it("ranks shown scores first, lowest mean first, then withheld rows by verified reports", async () => {
    const body = await listBody("/areas/assembly?within=rajasthan-jodhpur", [
      [row("s20-ac-122", null, 3), JODHPUR],
      [row("s20-ac-127", [80, 70, 60], 12), JODHPUR],
      [row("s20-ac-128", [20, 40, null], 30), JODHPUR],
      [row("s20-ac-129", null, 8), JODHPUR],
      [row("s20-ac-130", [70, 70, 70], 15), JODHPUR],
      [row("s20-ac-131", [70, 70, 70], 25), JODHPUR],
      [row("s20-ac-126", [null, null, null], 11), JODHPUR],
    ]);
    expect(ids(body)).toEqual(["s20-ac-128", "s20-ac-131", "s20-ac-130", "s20-ac-127", "s20-ac-126", "s20-ac-129", "s20-ac-122"]);
    expect(body.total).toBe(7);
  });

  it("returns withheld rows as stored, scores null with their reason and counts shown", async () => {
    const body = await listBody("/areas/assembly?within=rajasthan-jodhpur", [[row("s20-ac-129", null, 8), JODHPUR]]);
    expect(body.areas[0]?.scores).toEqual(withheldRow.scores);
    expect(body.areas[0]?.counts.verified_reports).toBe(8);
    expect(body.areas[0]?.metrics).toEqual(withheldRow.metrics);
  });

  it("keeps only areas of the kind whose sites lie within the district or local body", async () => {
    const rows = [
      [row("s20-ac-128", [40, 40, 40], 12), JODHPUR],
      [row("s20-ac-54", [10, 10, 10], 12), JAIPUR],
      [row("s20-pc-16", [30, 30, 30], 12, "loksabha"), [...JODHPUR, "rajasthan-phalodi"]],
      [row("s20-ac-122", null, 2), ["rajasthan-phalodi"]],
    ] as const;
    expect(ids(await listBody("/areas/assembly?within=rajasthan-jodhpur", rows))).toEqual(["s20-ac-128"]);
    await app?.close();
    expect(ids(await listBody("/areas/assembly?within=jaipur-mc", rows))).toEqual(["s20-ac-54"]);
    await app?.close();
    expect(ids(await listBody("/areas/loksabha?within=rajasthan-phalodi", rows))).toEqual(["s20-pc-16"]);
  });

  it("returns an empty list, not a 404, when no area has a site there", async () => {
    const body = await listBody("/areas/ward?within=rajasthan-jodhpur", []);
    expect(body).toEqual({ kind: "ward", within: "rajasthan-jodhpur", total: 0, limit: 50, areas: [] });
  });

  it("applies the limit after ranking, keeps the full total, and caps the limit at 200", async () => {
    const rows = [5, 9, 7].map((score, index) => [row(`s20-ac-12${index}`, [score, score, score], 10), JODHPUR] as const);
    const limited = await listBody("/areas/assembly?within=rajasthan-jodhpur&limit=2", rows);
    expect(ids(limited)).toEqual(["s20-ac-120", "s20-ac-122"]);
    expect([limited.total, limited.limit]).toEqual([3, 2]);
    await app?.close();
    expect((await listBody("/areas/assembly?within=rajasthan-jodhpur&limit=5000", rows)).limit).toBe(200);
  });

  it("queries the store once for the kind and within", async () => {
    const { app: started, scores } = await startWith([]);
    await started.inject({ url: "/areas/district?within=rajasthan-jodhpur" });
    expect(scores.listed).toEqual(["district rajasthan-jodhpur"]);
  });

  it.each([
    ["/areas/city?within=rajasthan-jodhpur", "kind"],
    ["/areas/assembly", "within"],
    ["/areas/assembly?within=Jodhpur%20City", "within"],
    ["/areas/assembly?within=a&within=b", "within"],
    ["/areas/assembly?within=rajasthan-jodhpur&limit=0", "limit"],
    ["/areas/assembly?within=rajasthan-jodhpur&limit=ten", "limit"],
    ["/areas/assembly?within=rajasthan-jodhpur&limit=2.5", "limit"],
  ])("returns 400 bad_request for %s", async (url, field) => {
    const response = await (await startWith([])).app.inject({ url });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request", message: expect.stringContaining(field) });
  });
});

describe("AreaRanking", () => {
  it("never ranks on a score below min_verified_reports, even if one were stored", () => {
    expect(AreaRanking.shownMean(row("s20-ac-128", [20, 40, null], 9))).toBeNull();
    expect(AreaRanking.shownMean(row("s20-ac-128", [20, 40, null], 10))).toBe(30);
    expect(AreaRanking.shownMean(row("s20-ac-128", null, 30))).toBeNull();
  });
});
