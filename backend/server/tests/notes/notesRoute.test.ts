import type { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { DynamoCommunityWriter } from "../../src/adapters/notes/DynamoCommunityWriter.js";
import { DynamoNoteStore } from "../../src/adapters/notes/DynamoNoteStore.js";
import { DynamoReportNotes } from "../../src/adapters/notes/DynamoReportNotes.js";
import { validateSiteNote } from "../../src/contracts/index.gen.js";
import { UnauthorizedError } from "../../src/domain/errors.js";
import { authorHash } from "../../src/domain/notes/AuthorHash.js";
import type { UserGuard } from "../../src/handlers/letters/LettersEndpoint.js";
import { NotesEndpoint } from "../../src/handlers/notes/NotesEndpoint.js";
import { createApp } from "../../src/handlers/web.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { DEVICE, USER } from "../letters/support.js";
import { CLEAN, notesWorld } from "./notesSupport.js";

const guard: UserGuard = {
  async requireUser(request) {
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? "")?.[1];
    if (token === undefined) {
      throw new UnauthorizedError("Sign in to do this.");
    }
    return { userId: token };
  },
};

let app: FastifyInstance | undefined;

async function server(): Promise<FastifyInstance> {
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [new NotesEndpoint(notesWorld().service, guard).plugin()], logger);
  return app;
}

function post(target: FastifyInstance, payload: object, user: string | null = USER, site = "site_jdh_1") {
  const headers = user === null ? {} : { authorization: `Bearer ${user}` };
  return target.inject({ method: "POST", url: `/sites/${site}/notes`, payload, headers });
}

const body = { text: "Burnt again last night, smoke everywhere.", language: "en", device_token: DEVICE };

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /sites/{id}/notes", () => {
  it("returns 201 with a site_note that never carries the author", async () => {
    const response = await post(await server(), body);
    expect(response.statusCode).toBe(201);
    const note = validateSiteNote(response.json());
    expect(note).toMatchObject({ status: "shown", text: body.text });
    expect(response.body).not.toContain(USER);
  });

  it("returns 401 without a sign-in token", async () => {
    expect((await post(await server(), body, null)).statusCode).toBe(401);
  });

  it.each([
    ["an empty note", { ...body, text: "   " }],
    ["a note over 280 characters", { ...body, text: "x".repeat(281) }],
    ["an unknown language", { ...body, language: "fr" }],
    ["no device token", { text: "ok", language: "en" }],
  ])("returns 400 bad_request for %s", async (_name, payload) => {
    const response = await post(await server(), payload);
    expect(response.statusCode).toBe(400);
  });

  it("returns 404 for an unknown or malformed site", async () => {
    const target = await server();
    expect((await post(target, body, USER, "site_none_1")).statusCode).toBe(404);
    expect((await post(target, body, USER, "SITE-1")).statusCode).toBe(404);
  });
});

describe("notes adapters", () => {
  it("stores a hidden note without its text and a shown one with only the author hash", async () => {
    const commands: PutCommand[] = [];
    const store = new DynamoNoteStore({ send: async (command: PutCommand) => (commands.push(command), { $metadata: {} }) } as never, "notes");
    const base = { noteId: "note_1", siteId: "site_jdh_1", authorHash: authorHash(USER), language: "en", moderation: CLEAN, createdAt: "2026-10-10T10:00:00Z" } as const;
    await store.add({ ...base, text: null });
    await store.add({ ...base, noteId: "note_2", text: "Smoke at night" });
    expect(commands[0]?.input.Item).toMatchObject({ status: "hidden", author_hash: authorHash(USER) });
    expect(commands[0]?.input.Item).not.toHaveProperty("text");
    expect(commands[1]?.input.Item).toMatchObject({ status: "shown", text: "Smoke at night" });
    expect(JSON.stringify(commands.map((command) => command.input.Item))).not.toContain(USER);
  });

  it("reads shown notes newest first", async () => {
    const commands: QueryCommand[] = [];
    const items = [{ text: "a", author_hash: "h1" }, { author_hash: "h2" }];
    const store = new DynamoNoteStore({ send: async (command: QueryCommand) => (commands.push(command), { $metadata: {}, Items: items }) } as never, "notes");
    expect(await store.shownFor("site_jdh_1")).toEqual([{ text: "a", authorHash: "h1" }]);
    expect(commands[0]?.input).toMatchObject({ ScanIndexForward: false, ExpressionAttributeValues: { ":shown": "shown" } });
  });

  it("reads only clean report notes, hashing the user id, else the device", async () => {
    const items = [
      { note: "clean, user", user_id: USER, device_token: DEVICE, moderation_result: { note_moderation: { result: "clean" } } },
      { note: "clean, guest", device_token: DEVICE, moderation_result: { note_moderation: { result: "clean" } } },
      { note: "removed", user_id: USER, moderation_result: { note_moderation: { result: "removed" } } },
      { note: "not checked yet", user_id: USER },
      { note: "withdrawn", user_id: USER, status: "withdrawn", moderation_result: { note_moderation: { result: "clean" } } },
    ];
    const reader = new DynamoReportNotes({ send: async () => ({ $metadata: {}, Items: items }) } as never, "reports");
    expect(await reader.shownFor("site_jdh_1")).toEqual([
      { text: "clean, user", authorHash: authorHash(USER) },
      { text: "clean, guest", authorHash: authorHash(DEVICE) },
    ]);
  });

  it("saves community on the site item and bumps its version", async () => {
    const commands: UpdateCommand[] = [];
    const writer = new DynamoCommunityWriter({ send: async (command: UpdateCommand) => (commands.push(command), { $metadata: {} }) } as never, "sites");
    await writer.save("site_jdh_1", { notes_count: 1 } as never);
    expect(commands[0]?.input).toMatchObject({
      Key: { site_id: "site_jdh_1" },
      UpdateExpression: "SET community = :community, version = if_not_exists(version, :zero) + :one",
      ConditionExpression: "attribute_exists(site_id)",
    });
  });
});
