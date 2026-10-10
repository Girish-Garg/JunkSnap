import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { DisabledCrawlStatusReader } from "../../src/adapters/DisabledCrawlStatusReader.js";
import { DynamoCrawlStatusReader } from "../../src/adapters/DynamoCrawlStatusReader.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { AwsCalls } from "../../src/adapters/sites/AwsCalls.js";
import { validateAreaCrawl, type AreaCrawl } from "../../src/contracts/index.gen.js";
import { areaCrawlRoutes, buildAreaCrawlRoutes } from "../../src/handlers/areaCrawlRoutes.js";
import { ROUTE_BUILDERS } from "../../src/handlers/routes.js";
import { createApp } from "../../src/handlers/web.js";
import type { CrawlStatusReader } from "../../src/ports/CrawlStatusReader.js";
import { AreaCrawlQuery } from "../../src/services/AreaCrawlQuery.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { fixture } from "../reportFakes.js";
import { failure, ScriptedClient } from "../sites/ScriptedClient.js";

const URL = "/areas/district/rajasthan-jodhpur/crawl";
const TABLE = "junksnap-dev-crawls";
const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
let app: FastifyInstance | undefined;

async function start(routes: FastifyPluginAsync): Promise<FastifyInstance> {
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(core, [routes], logger);
  return app;
}

function dynamo(item?: Record<string, unknown>): { client: ScriptedClient; reader: CrawlStatusReader } {
  const client = new ScriptedClient([() => (item === undefined ? {} : { Item: { district_id: "rajasthan-jodhpur", ...item } })]);
  return { client, reader: new DynamoCrawlStatusReader(client.as<DynamoDBDocumentClient>(), TABLE, new AwsCalls()) };
}

const get = async (reader: CrawlStatusReader, url = URL) => (await start(areaCrawlRoutes(new AreaCrawlQuery(reader)))).inject({ url });

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const NOT_STARTED: AreaCrawl = {
  district_id: "rajasthan-jodhpur",
  status: "not_started",
  queued_at: null,
  last_crawled_at: null,
  next_due_at: null,
  expected_by: null,
  wards_found: null,
};

describe("GET /areas/district/{id}/crawl", () => {
  it("answers not_started for a district without a row, reading one item by key", async () => {
    const { client, reader } = dynamo();
    const response = await get(reader);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(NOT_STARTED);
    expect(client.sent[0]).toMatchObject({ name: "GetCommand", input: { TableName: TABLE, Key: { district_id: "rajasthan-jodhpur" } } });
  });

  it("answers not_started for a row still counting verified reports", async () => {
    const response = await get(dynamo({ district_name: "Jodhpur", verified_report_ids: new Set(["rpt_a"]) }).reader);
    expect(response.json()).toEqual(NOT_STARTED);
  });

  it("maps a queued row with its expected time", async () => {
    const queued = { status: "queued", queued_at: "2026-10-10T09:30:15Z", next_due_at: "2026-10-10T09:30:15Z", expected_by: "2026-10-10T11:30:15Z" };
    const response = await get(dynamo(queued).reader);
    expect(validateAreaCrawl(response.json())).toEqual({ ...NOT_STARTED, ...queued });
  });

  it("answers the contract fixture from its row and leaves out the crawler's working fields", async () => {
    const sample = fixture<AreaCrawl>("area_crawl.jdh-1");
    const row = { ...sample, district_name: "Jodhpur", attempts: 0, results: [] };
    const response = await get(dynamo(row).reader, `/areas/district/${sample.district_id}/crawl`);
    expect(response.json()).toEqual(sample);
  });

  it("drops expected_by from a done crawl and keeps wards_found", async () => {
    const done = { status: "done", queued_at: "2026-10-10T09:12:40Z", last_crawled_at: "2026-10-10T09:40:02Z", next_due_at: "2026-11-09T09:40:02Z" };
    const response = await get(dynamo({ ...done, expected_by: "2026-10-10T11:12:40Z", wards_found: 160 }).reader);
    expect(response.json()).toEqual({ ...NOT_STARTED, ...done, wards_found: 160 });
  });

  it("answers 500 server_error for a row that breaks the contract", async () => {
    const response = await get(dynamo({ status: "paused" }).reader);
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: "server_error" });
  });

  it("answers 500 server_error when DynamoDB fails", async () => {
    const client = new ScriptedClient([failure("InternalServerError")]);
    const response = await get(new DynamoCrawlStatusReader(client.as<DynamoDBDocumentClient>(), TABLE, new AwsCalls()));
    expect(response.statusCode).toBe(500);
  });

  it.each(["/areas/district/Jodhpur/crawl", `/areas/district/${"a".repeat(65)}/crawl`])("answers 400 bad_request for %s", async (url) => {
    const response = await get(new DisabledCrawlStatusReader(), url);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
  });

  it("keeps GET /areas/{kind}/{id}/scores routable beside it", async () => {
    const all = await start(async (instance) => {
      await instance.register(buildAreaCrawlRoutes({ core, env: {} }));
      instance.get("/areas/:kind/:id/scores", async () => ({ ok: true }));
    });
    expect((await all.inject({ url: "/areas/district/rajasthan-jodhpur/scores" })).json()).toEqual({ ok: true });
    expect((await all.inject({ url: URL })).json()).toEqual(NOT_STARTED);
  });
});

describe("buildAreaCrawlRoutes", () => {
  it("is registered with the api routes", () => {
    expect(ROUTE_BUILDERS).toContain(buildAreaCrawlRoutes);
  });

  it("answers not_started without CRAWLS_TABLE, so local dev needs no table", async () => {
    const response = await (await start(buildAreaCrawlRoutes({ core, env: {} }))).inject({ url: URL });
    expect(response.json()).toEqual(NOT_STARTED);
  });

  it("registers with CRAWLS_TABLE set", async () => {
    await expect(start(buildAreaCrawlRoutes({ core, env: { CRAWLS_TABLE: TABLE } }))).resolves.toBeDefined();
  });
});
