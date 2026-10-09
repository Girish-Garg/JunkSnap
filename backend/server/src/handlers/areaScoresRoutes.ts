import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { FastifyPluginAsync } from "fastify";
import { DynamoScoreRepository } from "../adapters/DynamoScoreRepository.js";
import { AreaScoresQuery } from "../services/AreaScoresQuery.js";
import { AreaScoresSettings } from "../settings/AreaScoresSettings.js";
import type { RouteContext } from "./RouteBuilder.js";

interface AreaParams {
  readonly kind: string;
  readonly id: string;
}

export function areaScoresRoutes(query: AreaScoresQuery): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: AreaParams }>("/areas/:kind/:id/scores", async (request) =>
      query.find(request.params.kind, request.params.id),
    );
  };
}

// Settings load when the plugin registers, after the api has checked CORS_ORIGINS.
export function buildAreaScoresRoutes(context: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const settings = AreaScoresSettings.fromEnv(context.env);
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: context.core.awsRegion }));
    const query = new AreaScoresQuery(new DynamoScoreRepository(client, settings.scoresTable));
    await app.register(areaScoresRoutes(query));
  };
}
