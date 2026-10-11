import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoLetterCounter } from "../adapters/letters/DynamoLetterCounter.js";
import { DynamoSiteReader } from "../adapters/letters/DynamoSiteReader.js";
import { DynamoCommunityWriter } from "../adapters/notes/DynamoCommunityWriter.js";
import { DynamoNoteStore } from "../adapters/notes/DynamoNoteStore.js";
import { DynamoReportNotes } from "../adapters/notes/DynamoReportNotes.js";
import { LlmNoteModerator } from "../services/moderation/LlmNoteModerator.js";
import { WarnedPhotoTexts } from "../services/flags/WarnedPhotoTexts.js";
import { ScheduledCommunityRefresh } from "../services/notes/ScheduledCommunityRefresh.js";
import { NotesSettings } from "../settings/NotesSettings.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import { PhotoFlagsAssembly } from "./flags/PhotoFlagsAssembly.js";
import { PhotoFlagsEndpoint } from "./flags/PhotoFlagsEndpoint.js";
import { NoteRouterBuilder } from "./moderation/NoteRouterBuilder.js";
import { NotesAssembly, TimerScheduler } from "./notes/NotesAssembly.js";
import { NotesEndpoint } from "./notes/NotesEndpoint.js";
import type { RouteBuilder } from "./RouteBuilder.js";
import { SiteServiceFactory } from "./sites/SiteServiceFactory.js";
import { awsClientConfig } from "./utils.js";

// Notes and photo reports hold personal text, so moderation and analysis use the Bedrock-only note router, never the shared one.
export const buildNotesRoutes: RouteBuilder = (context) => async (app) => {
  const settings = NotesSettings.fromEnv(context.env);
  const guard = RouteGuard.fromEnv(context.env);
  const client = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(context.core.awsRegion)));
  const router = new NoteRouterBuilder(new BedrockRuntimeClient({ region: context.core.awsRegion })).build(app.log);
  const flags = new PhotoFlagsAssembly(settings, client, app.log);
  const moderator = new LlmNoteModerator(router);
  const scheduler = new TimerScheduler(app.log);
  const assembly = new NotesAssembly(settings.notesPerHour, app.log);
  const adapters = {
    sites: new DynamoSiteReader(client, settings.sitesTable),
    notes: new DynamoNoteStore(client, settings.notesTable),
    reportNotes: new DynamoReportNotes(client, settings.reportsTable),
    photoReports: new WarnedPhotoTexts(flags.store()),
    writer: new DynamoCommunityWriter(client, settings.sitesTable),
    counters: {
      devices: new DynamoLetterCounter(client, { name: settings.devicesTable, keyName: "device_token", prefix: "note" }),
      users: new DynamoLetterCounter(client, { name: settings.usersTable, keyName: "user_id", prefix: "note" }),
    },
    moderator,
    router,
    scheduler,
    now: () => new Date(),
  };
  const refresher = assembly.refresher(adapters);
  await app.register(new NotesEndpoint(assembly.service(adapters, refresher), guard).plugin());
  const site = SiteServiceFactory.fromEnv(context.core, context.env, app.log).flagSiteParts();
  const community = new ScheduledCommunityRefresh(scheduler, refresher, app.log);
  await app.register(new PhotoFlagsEndpoint(flags.service(site, { moderator, community }), guard).plugin());
};
