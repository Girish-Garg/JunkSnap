import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoLetterCounter } from "../adapters/letters/DynamoLetterCounter.js";
import { DynamoSiteReader } from "../adapters/letters/DynamoSiteReader.js";
import { ModelLetterWriter } from "../adapters/letters/ModelLetterWriter.js";
import { SystemLetterStamp } from "../adapters/letters/SystemLetterStamp.js";
import { LettersSettings } from "../settings/LettersSettings.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import { LettersAssembly } from "./letters/LettersAssembly.js";
import { LettersEndpoint } from "./letters/LettersEndpoint.js";
import { buildProviderRouter } from "./LlmModule.js";
import type { RouteBuilder } from "./RouteBuilder.js";

// Settings load inside the plugin, after createApp has checked CORS_ORIGINS.
export const buildLettersRoutes: RouteBuilder = (context) => async (app) => {
  const settings = LettersSettings.fromEnv(context.env);
  const guard = RouteGuard.fromEnv(context.env);
  const { sites, devices, users } = settings.tables;
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: context.core.awsRegion }));
  const service = await new LettersAssembly(settings.rulesDir, app.log).service({
    sites: new DynamoSiteReader(client, sites),
    counters: {
      devices: new DynamoLetterCounter(client, { name: devices, keyName: "device_token" }),
      users: new DynamoLetterCounter(client, { name: users, keyName: "user_id" }),
    },
    writer: new ModelLetterWriter(buildProviderRouter(context.env, context.core, app.log)),
    stamp: new SystemLetterStamp(),
  });
  await app.register(new LettersEndpoint(service, guard).plugin());
};
