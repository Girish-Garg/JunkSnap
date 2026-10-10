import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoLetterCounter } from "../adapters/letters/DynamoLetterCounter.js";
import { DynamoSiteReader } from "../adapters/letters/DynamoSiteReader.js";
import { DynamoCommunityWriter } from "../adapters/notes/DynamoCommunityWriter.js";
import { DynamoNoteStore } from "../adapters/notes/DynamoNoteStore.js";
import { DynamoReportNotes } from "../adapters/notes/DynamoReportNotes.js";
import { LlmNoteModerator } from "../services/moderation/LlmNoteModerator.js";
import { NotesSettings } from "../settings/NotesSettings.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import { NoteRouterBuilder } from "./moderation/NoteRouterBuilder.js";
import { NotesAssembly, TIMER_SCHEDULER } from "./notes/NotesAssembly.js";
import { NotesEndpoint } from "./notes/NotesEndpoint.js";
import type { RouteBuilder } from "./RouteBuilder.js";

// Notes hold personal text, so moderation and analysis use the Bedrock-only note router, never the shared one.
export const buildNotesRoutes: RouteBuilder = (context) => async (app) => {
  const settings = NotesSettings.fromEnv(context.env);
  const guard = RouteGuard.fromEnv(context.env);
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: context.core.awsRegion }));
  const router = new NoteRouterBuilder(new BedrockRuntimeClient({ region: context.core.awsRegion })).build(app.log);
  const service = new NotesAssembly(settings.notesPerHour, app.log).service({
    sites: new DynamoSiteReader(client, settings.sitesTable),
    notes: new DynamoNoteStore(client, settings.notesTable),
    reportNotes: new DynamoReportNotes(client, settings.reportsTable),
    writer: new DynamoCommunityWriter(client, settings.sitesTable),
    counters: {
      devices: new DynamoLetterCounter(client, { name: settings.devicesTable, keyName: "device_token", prefix: "note" }),
      users: new DynamoLetterCounter(client, { name: settings.usersTable, keyName: "user_id", prefix: "note" }),
    },
    moderator: new LlmNoteModerator(router),
    router,
    scheduler: TIMER_SCHEDULER,
    now: () => new Date(),
  });
  await app.register(new NotesEndpoint(service, guard).plugin());
};
