import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { FastifyPluginAsync } from "fastify";
import { DynamoScoreLister } from "../adapters/DynamoScoreLister.js";
import { DynamoScoreRepository } from "../adapters/DynamoScoreRepository.js";
import type { QueryValue } from "../domain/AreaListRequest.js";
import { AreaListQuery } from "../services/AreaListQuery.js";
import { AreaScoresQuery } from "../services/AreaScoresQuery.js";
import { AreaListSettings } from "../settings/AreaListSettings.js";
import { AreaScoresSettings } from "../settings/AreaScoresSettings.js";
import type { RouteContext } from "./RouteBuilder.js";
import { awsClientConfig } from "./utils.js";

interface AreaParams {
  readonly kind: string;
  readonly id: string;
}

interface AreaListQuerystring {
  readonly within?: QueryValue;
  readonly limit?: QueryValue;
}

export interface AreaQueries {
  readonly scores: AreaScoresQuery;
  readonly list: AreaListQuery;
}

export function areaScoresRoutes(queries: AreaQueries): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: AreaParams }>("/areas/:kind/:id/scores", async (request) =>
      queries.scores.find(request.params.kind, request.params.id),
    );
    app.get<{ Params: Pick<AreaParams, "kind">; Querystring: AreaListQuerystring }>("/areas/:kind", async (request) =>
      queries.list.list({ kind: request.params.kind, within: request.query.within, limit: request.query.limit }),
    );
  };
}

// Settings load when the plugin registers, after the api has checked CORS_ORIGINS.
export function buildAreaScoresRoutes(context: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const settings = AreaScoresSettings.fromEnv(context.env);
    const client = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(context.core.awsRegion)));
    const scores = new AreaScoresQuery(new DynamoScoreRepository(client, settings.scoresTable));
    const list = new AreaListQuery(new DynamoScoreLister(client, settings.scoresTable, app.log), AreaListSettings.fromEnv(context.env));
    await app.register(areaScoresRoutes({ scores, list }));
  };
}
