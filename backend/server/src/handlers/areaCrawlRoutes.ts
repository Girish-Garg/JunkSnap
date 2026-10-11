import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { FastifyPluginAsync } from "fastify";
import { DisabledCrawlStatusReader } from "../adapters/DisabledCrawlStatusReader.js";
import { DynamoCrawlStatusReader } from "../adapters/DynamoCrawlStatusReader.js";
import { AwsCalls } from "../adapters/sites/AwsCalls.js";
import type { CrawlStatusReader } from "../ports/CrawlStatusReader.js";
import { AreaCrawlQuery } from "../services/AreaCrawlQuery.js";
import { CrawlSettings } from "../settings/CrawlSettings.js";
import type { RouteContext } from "./RouteBuilder.js";
import { awsClientConfig } from "./utils.js";

interface DistrictParams {
  readonly id: string;
}

// Open route: the crawl banner shows for guests too.
export function areaCrawlRoutes(query: AreaCrawlQuery): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: DistrictParams }>("/areas/district/:id/crawl", async (request) => query.find(request.params.id));
  };
}

export function buildAreaCrawlRoutes(context: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const { crawlsTable } = CrawlSettings.fromEnv(context.env);
    await app.register(areaCrawlRoutes(new AreaCrawlQuery(crawlReader(context, crawlsTable))));
  };
}

function crawlReader(context: RouteContext, table: string | null): CrawlStatusReader {
  if (table === null) {
    return new DisabledCrawlStatusReader();
  }
  const client = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(context.core.awsRegion)));
  return new DynamoCrawlStatusReader(client, table, new AwsCalls());
}
