import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoScoreRepository } from "../adapters/DynamoScoreRepository.js";
import { DynamoAreaLetterSites } from "../adapters/letters/DynamoAreaLetterSites.js";
import { DynamoLetterCounter } from "../adapters/letters/DynamoLetterCounter.js";
import { DynamoSiteReader } from "../adapters/letters/DynamoSiteReader.js";
import { ModelAreaLetterWriter } from "../adapters/letters/ModelAreaLetterWriter.js";
import { ModelLetterWriter } from "../adapters/letters/ModelLetterWriter.js";
import { SystemLetterStamp } from "../adapters/letters/SystemLetterStamp.js";
import { AreaScoresSettings } from "../settings/AreaScoresSettings.js";
import { BinSettings } from "../settings/BinSettings.js";
import { RateLimitSettings } from "../settings/RateLimitSettings.js";
import { LettersSettings } from "../settings/LettersSettings.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import { AreaLettersEndpoint } from "./letters/AreaLettersEndpoint.js";
import { LettersAssembly } from "./letters/LettersAssembly.js";
import { LettersEndpoint } from "./letters/LettersEndpoint.js";
import { buildProviderRouter } from "./LlmModule.js";
import type { RouteBuilder } from "./RouteBuilder.js";
import { awsClientConfig } from "./utils.js";

// Settings load inside the plugin, after createApp has checked CORS_ORIGINS.
export const buildLettersRoutes: RouteBuilder = (context) => async (app) => {
  const settings = LettersSettings.fromEnv(context.env);
  const scoresTable = AreaScoresSettings.fromEnv(context.env).scoresTable;
  const guard = RouteGuard.fromEnv(context.env);
  const { sites, devices, users } = settings.tables;
  const client = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(context.core.awsRegion)));
  const model = buildProviderRouter(context.env, context.core, app.log);
  const counters = {
    devices: new DynamoLetterCounter(client, { name: devices, keyName: "device_token" }),
    users: new DynamoLetterCounter(client, { name: users, keyName: "user_id" }),
  };
  const assembly = new LettersAssembly(settings.rulesDir, app.log, BinSettings.fromEnv(context.env), RateLimitSettings.fromEnv(context.env).lettersPerHour);
  const stamp = new SystemLetterStamp();
  const siteLetters = await assembly.service({
    sites: new DynamoSiteReader(client, sites),
    counters,
    writer: new ModelLetterWriter(model),
    stamp,
  });
  const areaLetters = await assembly.areaService({
    sites: new DynamoAreaLetterSites(client, sites),
    scores: new DynamoScoreRepository(client, scoresTable),
    counters,
    writer: new ModelAreaLetterWriter(model),
    stamp,
  });
  await app.register(new LettersEndpoint(siteLetters, guard).plugin());
  await app.register(new AreaLettersEndpoint(areaLetters, guard).plugin());
};
