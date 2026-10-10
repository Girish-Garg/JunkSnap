import type { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { DynamoPhotoFlagStore } from "../../src/adapters/flags/DynamoPhotoFlagStore.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { DynamoNoteStore } from "../../src/adapters/notes/DynamoNoteStore.js";
import { validatePhotoFlag } from "../../src/contracts/index.gen.js";
import { UnauthorizedError } from "../../src/domain/errors.js";
import { authorHash } from "../../src/domain/notes/AuthorHash.js";
import { PhotoFlagsEndpoint } from "../../src/handlers/flags/PhotoFlagsEndpoint.js";
import type { UserGuard } from "../../src/handlers/letters/LettersEndpoint.js";
import { createApp } from "../../src/handlers/web.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { DEVICE_A, userOf } from "../sites/builders.js";
import { FIRST_PHOTO, flagger, flagRig, seeded, SITE } from "./flagFakes.js";

const guard: UserGuard = {
  async requireUser(request) {
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? "")?.[1];
    if (token === undefined) {
      throw new UnauthorizedError("Sign in to do this.");
    }
    return { userId: token };
  },
};

const NEIGHBOUR = flagger(1);
const body = { reason: "unrelated", text: "  Not this plot, this is the next street.  ", device_token: NEIGHBOUR.deviceToken };

let app: FastifyInstance | undefined;

async function server(): Promise<FastifyInstance> {
  const rig = flagRig();
  seeded(rig, true);
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), [new PhotoFlagsEndpoint(rig.service, guard).plugin()], logger);
  return app;
}

function post(target: FastifyInstance, payload: object, user: string | null = NEIGHBOUR.userId, photo = FIRST_PHOTO) {
  const headers = user === null ? {} : { authorization: `Bearer ${user}` };
  return target.inject({ method: "POST", url: `/sites/${SITE}/photos/${photo}/flags`, payload, headers });
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /sites/{id}/photos/{photo}/flags", () => {
  it("returns 200 with a photo_flag that never carries the reporter or the description", async () => {
    const response = await post(await server(), body);
    expect(response.statusCode).toBe(200);
    expect(validatePhotoFlag(response.json())).toMatchObject({ photo_id: FIRST_PHOTO, text_status: "shown", photo: { count: 1 } });
    expect(response.body).not.toContain(NEIGHBOUR.userId);
    expect(response.body).not.toContain("next street");
  });

  it("returns 401 without a sign-in token", async () => {
    expect((await post(await server(), body, null)).statusCode).toBe(401);
  });

  it.each([
    ["an unknown reason", { ...body, reason: "ugly" }],
    ["a description over 200 characters", { ...body, text: "x".repeat(201) }],
    ["no device token", { reason: "duplicate" }],
  ])("returns 400 bad_request for %s", async (_name, payload) => {
    expect((await post(await server(), payload)).statusCode).toBe(400);
  });

  it("returns 404 for a malformed photo id", async () => {
    expect((await post(await server(), body, NEIGHBOUR.userId, "PHOTO-1")).statusCode).toBe(404);
  });

  it("returns 403 own_photo to the photo's reporter", async () => {
    const response = await post(await server(), { ...body, device_token: DEVICE_A }, userOf(DEVICE_A));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "own_photo" });
  });
});

describe("photo report adapters", () => {
  const flag = {
    siteId: SITE,
    photoId: FIRST_PHOTO,
    authorHash: authorHash(NEIGHBOUR.userId),
    deviceHash: authorHash(NEIGHBOUR.deviceToken),
    reason: "offensive",
    textStatus: "hidden",
    text: null,
    moderation: null,
    createdAt: "2026-10-11T03:10:00Z",
  } as const;

  it("keeps one row per person per photo in the notes table, with hashes only", async () => {
    const commands: PutCommand[] = [];
    const store = new DynamoPhotoFlagStore({ send: async (command: PutCommand) => (commands.push(command), { $metadata: {} }) } as never, "notes");
    await store.put(flag);
    const item = commands[0]?.input.Item;
    expect(item).toMatchObject({ site_id: SITE, note_id: `flag#${FIRST_PHOTO}#${flag.authorHash}`, kind: "photo_flag", text_status: "hidden" });
    expect(item).not.toHaveProperty("text");
    expect(commands[0]?.input.ConditionExpression).toBeUndefined();
    expect(JSON.stringify(item)).not.toContain(NEIGHBOUR.userId);
  });

  it("reads a photo's reports consistently by sort key prefix, and only shown descriptions for analysis", async () => {
    const commands: QueryCommand[] = [];
    const items = [
      { author_hash: "a", device_hash: "d1", text_status: "shown", text: "wrong place" },
      { author_hash: "b", device_hash: "d2", text_status: "hidden" },
    ];
    const store = new DynamoPhotoFlagStore({ send: async (command: QueryCommand) => (commands.push(command), { $metadata: {}, Items: items }) } as never, "notes");
    expect(await store.authorsOf(SITE, FIRST_PHOTO)).toEqual([{ authorHash: "a", deviceHash: "d1" }, { authorHash: "b", deviceHash: "d2" }]);
    expect(commands[0]?.input).toMatchObject({ ConsistentRead: true, ExpressionAttributeValues: { ":prefix": `flag#${FIRST_PHOTO}#` } });
    expect(await store.shownFor(SITE)).toEqual([{ text: "wrong place", authorHash: "a", source: "photo_report" }]);
  });

  it("reads notes without the photo report rows", async () => {
    const commands: QueryCommand[] = [];
    const store = new DynamoNoteStore({ send: async (command: QueryCommand) => (commands.push(command), { $metadata: {}, Items: [] }) } as never, "notes");
    await store.shownFor(SITE);
    expect(commands[0]?.input.KeyConditionExpression).toContain("begins_with(note_id, :note)");
    expect(commands[0]?.input.ExpressionAttributeValues).toMatchObject({ ":note": "note_" });
  });
});
