import type { ScanCommand, ScanCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { DynamoAreaLetterSites } from "../../src/adapters/letters/DynamoAreaLetterSites.js";
import { validateAreaLetterDraft } from "../../src/contracts/index.gen.js";
import { AreaKey } from "../../src/domain/AreaKey.js";
import { ExternalServiceError, UnauthorizedError } from "../../src/domain/errors.js";
import { AreaLettersEndpoint } from "../../src/handlers/letters/AreaLettersEndpoint.js";
import type { UserGuard } from "../../src/handlers/letters/LettersEndpoint.js";
import { createApp } from "../../src/handlers/web.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { ASSEMBLY, areaLetterService } from "./areaSupport.js";
import { DEVICE, USER, wardSite } from "./support.js";

const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
const body = { issue: "waste_dump", language: "en", device_token: DEVICE };

const fakeGuard: UserGuard = {
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
  app = await createApp(core, [new AreaLettersEndpoint(await areaLetterService(), fakeGuard).plugin()], logger);
  return app;
}

function post(target: FastifyInstance, path: string, payload: object = body, user: string | null = USER) {
  const headers = user === null ? {} : { authorization: `Bearer ${user}` };
  return target.inject({ method: "POST", url: path, payload, headers });
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("POST /areas/{kind}/{id}/letters", () => {
  const path = `/areas/assembly/${ASSEMBLY}/letters`;

  it("returns an area_letter_draft that validates", async () => {
    const response = await post(await server(), path);
    expect(response.statusCode).toBe(200);
    const letter = validateAreaLetterDraft(response.json());
    expect(letter.evidence.verified_reports).toBe(12);
  });

  it("returns 401 without a sign-in token", async () => {
    const response = await post(await server(), path, body, null);
    expect(response.statusCode).toBe(401);
  });

  it.each([
    ["an unknown area kind", "/areas/city/jodhpur/letters", body],
    ["a bad area id", "/areas/assembly/S20_AC/letters", body],
    ["an unknown issue", path, { ...body, issue: "graffiti" }],
    ["a language other than en or hi", path, { ...body, language: "fr" }],
    ["no device token", path, { issue: "all", language: "en" }],
  ])("returns 400 bad_request for %s", async (_name, target, payload) => {
    const response = await post(await server(), target, payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
  });

  it("returns 404 area_not_found for an area with no sites", async () => {
    const response = await post(await server(), "/areas/assembly/s20-ac-1/letters");
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "area_not_found" });
  });

  it("returns 409 not_verified with the count the app shows", async () => {
    const response = await post(await server(), path, { ...body, issue: "no_bin" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "not_verified", message: expect.stringContaining("(3 of 10)") });
  });
});

describe("DynamoAreaLetterSites", () => {
  const stored = (id: string, extra: Record<string, unknown> = {}) => {
    const site = wardSite();
    const [lon, lat] = site.geometry.coordinates;
    return { ...site.properties, site_id: id, lat, lon, ...extra };
  };

  it("filters on the area's location field, follows pages and keeps reporter ids private to the api", async () => {
    const commands: ScanCommand[] = [];
    const pages: ScanCommandOutput[] = [
      { $metadata: {}, Items: [stored("site_d1", { reporter_ids: ["u1", "u2"] })], LastEvaluatedKey: { site_id: "site_d1" } },
      { $metadata: {}, Items: [stored("site_d2", { reporter_devices: ["d1"] }), { site_id: "site_bad" }] },
    ];
    const reader = new DynamoAreaLetterSites({ send: async (command) => (commands.push(command), pages.shift() ?? { $metadata: {} }) }, "t");
    const batch = await reader.sitesIn(AreaKey.parse("assembly", ASSEMBLY));
    expect(batch.sites.map((entry) => [entry.site.properties.site_id, entry.reporterIds])).toEqual([
      ["site_d1", ["u1", "u2"]],
      ["site_d2", ["d1"]],
    ]);
    expect(batch.unreadable).toBe(1);
    expect(commands[0]?.input).toMatchObject({
      FilterExpression: "#location.#area.#id = :id",
      ExpressionAttributeNames: { "#location": "location", "#area": "assembly_seat", "#id": "id" },
      ExpressionAttributeValues: { ":id": ASSEMBLY },
    });
    expect(commands[1]?.input.ExclusiveStartKey).toEqual({ site_id: "site_d1" });
    expect(JSON.stringify(batch.sites[0]?.site)).not.toContain("u1");
  });

  it("raises ExternalServiceError when the scan fails", async () => {
    const reader = new DynamoAreaLetterSites({ send: async () => Promise.reject(new Error("AccessDenied")) }, "t");
    await expect(reader.sitesIn(AreaKey.parse("ward", "jodhpur-mc-w37"))).rejects.toThrow(ExternalServiceError);
  });
});
