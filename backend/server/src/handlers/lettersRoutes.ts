import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoScoreRepository } from "../adapters/DynamoScoreRepository.js";
import { DynamoAreaLetterSites } from "../adapters/letters/DynamoAreaLetterSites.js";
import { DynamoLetterCounter, type CounterRetry } from "../adapters/letters/DynamoLetterCounter.js";
import { DynamoSiteReader } from "../adapters/letters/DynamoSiteReader.js";
import { ModelAreaLetterWriter } from "../adapters/letters/ModelAreaLetterWriter.js";
import { ModelLetterWriter } from "../adapters/letters/ModelLetterWriter.js";
import { SystemLetterStamp } from "../adapters/letters/SystemLetterStamp.js";
import type { LetterCounters } from "../services/letters/LetterRateLimiter.js";
import { AreaScoresSettings } from "../settings/AreaScoresSettings.js";
import { LettersSettings } from "../settings/LettersSettings.js";
import { ModelLimitSettings } from "../settings/ModelLimitSettings.js";
import { PagingSettings } from "../settings/PagingSettings.js";
import { RetrySettings } from "../settings/RetrySettings.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import { AreaLettersEndpoint } from "./letters/AreaLettersEndpoint.js";
import { LettersAssembly } from "./letters/LettersAssembly.js";
import { LettersEndpoint } from "./letters/LettersEndpoint.js";
import { buildProviderRouter } from "./LlmModule.js";
import type { RouteBuilder } from "./RouteBuilder.js";
import { TimeoutSettings } from "../settings/TimeoutSettings.js";
import { awsClientConfig } from "./utils.js";

// Settings load inside the plugin, after createApp has checked CORS_ORIGINS.
export const buildLettersRoutes: RouteBuilder = (context) => async (app) => {
  const settings = LettersSettings.fromEnv(context.env);
  const scoresTable = AreaScoresSettings.fromEnv(context.env).scoresTable;
  const guard = RouteGuard.fromEnv(context.env);
  const { sites, devices, users } = settings.tables;
  const client = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(context.core.awsRegion, TimeoutSettings.fromEnv(context.env).aws.quick)));
  const model = buildProviderRouter(context.env, context.core, app.log);
  const models = ModelLimitSettings.fromEnv(context.env);
  const counters = letterCounters(client, { devices, users }, RetrySettings.fromEnv(context.env).counter);
  const assembly = new LettersAssembly(settings.rulesDir, app.log, LettersAssembly.tunables(context.env));
  const stamp = new SystemLetterStamp();
  const siteLetters = await assembly.service({
    sites: new DynamoSiteReader(client, sites),
    counters,
    writer: new ModelLetterWriter(model, models.letters),
    stamp,
  });
  const areaLetters = await assembly.areaService({
    sites: new DynamoAreaLetterSites(client, sites, PagingSettings.fromEnv(context.env).areaLetterMaxPages),
    scores: new DynamoScoreRepository(client, scoresTable),
    counters,
    writer: new ModelAreaLetterWriter(model, models.areaLetters),
    stamp,
  });
  await app.register(new LettersEndpoint(siteLetters, guard).plugin());
  await app.register(new AreaLettersEndpoint(areaLetters, guard).plugin());
};

// Windowed counters on letter_window_start and letter_count, shared by site and area letters.
function letterCounters(client: DynamoDBDocumentClient, tables: { devices: string; users: string }, retry: CounterRetry): LetterCounters {
  return {
    devices: new DynamoLetterCounter(client, { name: tables.devices, keyName: "device_token" }, retry),
    users: new DynamoLetterCounter(client, { name: tables.users, keyName: "user_id" }, retry),
  };
}
