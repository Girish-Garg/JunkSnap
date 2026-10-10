import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { FastifyPluginAsync } from "fastify";
import { DynamoScoreRepository } from "../adapters/DynamoScoreRepository.js";
import { AreaCardWriter } from "../domain/share/AreaCardWriter.js";
import { ShareUrls } from "../domain/share/ShareUrls.js";
import { SiteCardWriter } from "../domain/share/SiteCardWriter.js";
import { AreaScoresQuery } from "../services/AreaScoresQuery.js";
import { ShareCardService } from "../services/share/ShareCardService.js";
import { AreaScoresSettings } from "../settings/AreaScoresSettings.js";
import { ShareSettings } from "../settings/ShareSettings.js";
import type { RouteContext } from "./RouteBuilder.js";
import { CheckedSiteSource } from "./share/CheckedSiteSource.js";
import { ShareRoutes } from "./share/ShareRoutes.js";
import { SiteServiceFactory } from "./sites/SiteServiceFactory.js";

// Link previews for shared site and area links; open, read-only, and the same reads as GET /sites/{id} and area scores.
export function buildShareRoutes(context: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const urls = new ShareUrls(ShareSettings.fromEnv(context.env, context.core));
    const sites = SiteServiceFactory.fromEnv(context.core, context.env, app.log).finder();
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: context.core.awsRegion }));
    const scores = new DynamoScoreRepository(client, AreaScoresSettings.fromEnv(context.env).scoresTable);
    const cards = new ShareCardService({
      sites: new CheckedSiteSource(sites),
      areas: new AreaScoresQuery(scores),
      siteCards: new SiteCardWriter(urls),
      areaCards: new AreaCardWriter(urls),
    });
    await app.register(new ShareRoutes(cards).plugin());
  };
}
