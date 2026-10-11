import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoLetterCounter, type CounterRetry } from "../adapters/letters/DynamoLetterCounter.js";
import { DynamoSiteReader } from "../adapters/letters/DynamoSiteReader.js";
import { DynamoCommunityWriter } from "../adapters/notes/DynamoCommunityWriter.js";
import { DynamoNoteStore } from "../adapters/notes/DynamoNoteStore.js";
import { DynamoReportNotes } from "../adapters/notes/DynamoReportNotes.js";
import { LlmNoteModerator } from "../services/moderation/LlmNoteModerator.js";
import { WarnedPhotoTexts } from "../services/flags/WarnedPhotoTexts.js";
import type { LetterCounters } from "../services/letters/LetterRateLimiter.js";
import { ScheduledCommunityRefresh } from "../services/notes/ScheduledCommunityRefresh.js";
import { NotesSettings } from "../settings/NotesSettings.js";
import { ModelLimitSettings } from "../settings/ModelLimitSettings.js";
import { PagingSettings } from "../settings/PagingSettings.js";
import { RetrySettings } from "../settings/RetrySettings.js";
import { SiteRuleSettings } from "../settings/SiteRuleSettings.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import { PhotoFlagsAssembly } from "./flags/PhotoFlagsAssembly.js";
import { PhotoFlagsEndpoint } from "./flags/PhotoFlagsEndpoint.js";
import { NoteRouterBuilder } from "./moderation/NoteRouterBuilder.js";
import { NotesAssembly, TimerScheduler } from "./notes/NotesAssembly.js";
import { NotesEndpoint } from "./notes/NotesEndpoint.js";
import type { RouteBuilder } from "./RouteBuilder.js";
import { SiteServiceFactory } from "./sites/SiteServiceFactory.js";
import { TimeoutSettings } from "../settings/TimeoutSettings.js";
import { awsClientConfig } from "./utils.js";

// Notes and photo reports hold personal text, so moderation and analysis use the Bedrock-only note router, never the shared one.
export const buildNotesRoutes: RouteBuilder = (context) => async (app) => {
  const settings = NotesSettings.fromEnv(context.env);
  const guard = RouteGuard.fromEnv(context.env);
  const timeouts = TimeoutSettings.fromEnv(context.env);
  const client = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(context.core.awsRegion, timeouts.aws.quick)));
  const router = NoteRouterBuilder.fromEnv(new BedrockRuntimeClient({ region: context.core.awsRegion }), context.env).build(app.log);
  const flags = new PhotoFlagsAssembly(settings, client, app.log, PhotoFlagsAssembly.tunables(context.env));
  const { notesMaxPages } = PagingSettings.fromEnv(context.env);
  const moderator = new LlmNoteModerator(router, ModelLimitSettings.fromEnv(context.env).noteModerationMaxTokens);
  const scheduler = new TimerScheduler(app.log);
  const assembly = new NotesAssembly(NotesAssembly.limits(settings, context.env), app.log);
  const adapters = {
    sites: new DynamoSiteReader(client, settings.sitesTable),
    notes: new DynamoNoteStore(client, settings.notesTable, notesMaxPages),
    reportNotes: new DynamoReportNotes(client, settings.reportsTable, notesMaxPages),
    photoReports: new WarnedPhotoTexts(flags.store(), SiteRuleSettings.fromEnv(context.env).flags),
    writer: new DynamoCommunityWriter(client, settings.sitesTable),
    counters: noteCounters(client, settings, RetrySettings.fromEnv(context.env).counter),
    moderator, router, scheduler,
    now: () => new Date(),
  };
  const refresher = assembly.refresher(adapters);
  await app.register(new NotesEndpoint(assembly.service(adapters, refresher), guard).plugin());
  const site = SiteServiceFactory.fromEnv(context.core, context.env, app.log).flagSiteParts();
  const community = new ScheduledCommunityRefresh(scheduler, refresher, app.log);
  await app.register(new PhotoFlagsEndpoint(flags.service(site, { moderator, community }), guard).plugin());
};

// Windowed counters on note_window_start and note_count in the devices and users rows.
function noteCounters(client: DynamoDBDocumentClient, settings: NotesSettings, retry: CounterRetry): LetterCounters {
  return {
    devices: new DynamoLetterCounter(client, { name: settings.devicesTable, keyName: "device_token", prefix: "note" }, retry),
    users: new DynamoLetterCounter(client, { name: settings.usersTable, keyName: "user_id", prefix: "note" }, retry),
  };
}
